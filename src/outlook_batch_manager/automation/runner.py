from __future__ import annotations

import json
import random
import string
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from datetime import datetime
from typing import Callable, Iterable

from outlook_batch_manager.automation.base import MockAutomationDriver, RegistrationPayload
from outlook_batch_manager.automation.playwright_driver import PlaywrightAutomationDriver, PlaywrightOptions
from outlook_batch_manager.models import (
    AccountStatus,
    ConnectivityStatus,
    MailSource,
    ProxyStatus,
    RegisterTaskConfig,
    TaskLogRecord,
    TaskProgress,
    TaskRecord,
    TaskStatus,
    TaskType,
    TokenRecord,
    TokenStatus,
)
from outlook_batch_manager.services.account_service import AccountService
from outlook_batch_manager.services.mail_service import MailService
from outlook_batch_manager.services.proxy_service import ProxyService
from outlook_batch_manager.services.settings_service import SettingsService
from outlook_batch_manager.storage.database import Database


class TaskRunner:
    def __init__(
        self,
        database: Database,
        accounts: AccountService,
        mail: MailService,
        proxies: ProxyService,
        settings: SettingsService,
    ) -> None:
        self.database = database
        self.accounts = accounts
        self.mail = mail
        self.proxies = proxies
        self.settings = settings

    def list_tasks(self) -> list[TaskRecord]:
        with self.database.connect() as connection:
            rows = connection.execute("SELECT * FROM tasks ORDER BY id DESC").fetchall()
        return [
            TaskRecord(
                id=int(row["id"]),
                task_type=TaskType(row["task_type"]),
                config_snapshot=json.loads(row["config_snapshot"]),
                status=TaskStatus(row["status"]),
                success_count=int(row["success_count"]),
                failure_count=int(row["failure_count"]),
                started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
                finished_at=datetime.fromisoformat(row["finished_at"]) if row["finished_at"] else None,
                latest_error=row["latest_error"],
            )
            for row in rows
        ]

    def get_logs(self, task_id: int, limit: int = 50) -> list[TaskLogRecord]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM task_logs WHERE task_id = ? ORDER BY id DESC LIMIT ?",
                (task_id, limit),
            ).fetchall()
        return [
            TaskLogRecord(
                id=int(row["id"]),
                task_id=int(row["task_id"]),
                level=row["level"],
                message=row["message"],
                account_email=row["account_email"],
                created_at=datetime.fromisoformat(row["created_at"]),
            )
            for row in rows
        ]

    def run_registration_task(
        self,
        config: RegisterTaskConfig,
        progress_callback: Callable[[TaskProgress], None] | None = None,
    ) -> int:
        task_id = self._create_task(TaskType.REGISTER, asdict(config))
        self._update_task_status(task_id, TaskStatus.RUNNING)
        driver = self._build_driver()
        success_count = 0
        failure_count = 0

        def worker() -> tuple[bool, str]:
            proxy = self.proxies.next_proxy()
            payload = self._random_registration_payload()
            result = driver.register(payload, proxy.server if proxy else None)
            if not result.success or not result.account:
                if proxy:
                    self.proxies.update_status(proxy.id, ProxyStatus.UNHEALTHY)
                return False, result.message

            verify = driver.verify_login(result.account.email, result.account.password, proxy.server if proxy else None)
            if not verify.success:
                if proxy:
                    self.proxies.update_status(proxy.id, ProxyStatus.UNHEALTHY)
                return False, f"{result.account.email} 登录校验失败"

            if proxy:
                self.proxies.update_status(proxy.id, ProxyStatus.HEALTHY)
            result.account.status = AccountStatus.ACTIVE
            result.account.connectivity_status = ConnectivityStatus.CONNECTED
            result.account.last_login_check_at = datetime.now()
            result.account.import_format = "generated"
            saved = self.accounts.upsert_account(result.account)
            if config.fetch_token and saved.id is not None:
                token_result = driver.refresh_token(saved.email, saved.password, proxy.server if proxy else None)
                self.accounts.save_token(
                    TokenRecord(
                        account_id=saved.id,
                        access_token=token_result.access_token,
                        refresh_token=token_result.refresh_token,
                        expires_at=token_result.expires_at,
                        last_refreshed_at=datetime.now() if token_result.success else None,
                        status=TokenStatus.VALID if token_result.success else TokenStatus.FAILED,
                    )
                )
            return True, f"{saved.email} 注册并入库成功"

        with ThreadPoolExecutor(max_workers=config.concurrent_workers) as executor:
            futures = [executor.submit(worker) for _ in range(config.batch_size)]
            for future in as_completed(futures):
                ok, message = future.result()
                if ok:
                    success_count += 1
                    self._append_log(task_id, "INFO", message)
                else:
                    failure_count += 1
                    self._append_log(task_id, "ERROR", message)
                self._update_task_counts(task_id, success_count, failure_count, "" if ok else message)
                if progress_callback:
                    progress_callback(
                        TaskProgress(
                            task_id,
                            TaskType.REGISTER,
                            TaskStatus.RUNNING,
                            success_count,
                            failure_count,
                            message,
                            self.get_logs(task_id, 10),
                        )
                    )

        final_status = TaskStatus.COMPLETED if failure_count == 0 else TaskStatus.FAILED
        self._update_task_status(task_id, final_status)
        if progress_callback:
            progress_callback(
                TaskProgress(
                    task_id,
                    TaskType.REGISTER,
                    final_status,
                    success_count,
                    failure_count,
                    "注册任务结束",
                    self.get_logs(task_id, 10),
                )
            )
        return task_id

    def run_login_check_task(
        self,
        account_ids: Iterable[int] | None = None,
        progress_callback: Callable[[TaskProgress], None] | None = None,
    ) -> int:
        target_ids = set(account_ids or [])
        snapshot = {"account_ids": sorted(target_ids)} if target_ids else {}
        task_id = self._create_task(TaskType.LOGIN_CHECK, snapshot)
        self._update_task_status(task_id, TaskStatus.RUNNING)
        success_count = 0
        failure_count = 0
        for account in self._iter_target_accounts(target_ids):
            ok, message = self._run_single_login_check(account.id or 0)
            refreshed = self.accounts.get_account(account.id or 0)
            log_level = "INFO" if ok else "ERROR"
            self._append_log(task_id, log_level, message, account.email)
            if ok:
                success_count += 1
            else:
                failure_count += 1
            self._update_task_counts(task_id, success_count, failure_count, "" if ok else message)
            if progress_callback:
                progress_callback(
                    TaskProgress(
                        task_id,
                        TaskType.LOGIN_CHECK,
                        TaskStatus.RUNNING,
                        success_count,
                        failure_count,
                        message,
                        self.get_logs(task_id, 10),
                    )
                )
            if refreshed is None:
                continue
        self._update_task_status(task_id, TaskStatus.COMPLETED if failure_count == 0 else TaskStatus.FAILED)
        return task_id

    def test_account_connectivity(self, account_id: int) -> dict[str, object]:
        ok, message = self._run_single_login_check(account_id)
        account = self.accounts.get_account(account_id)
        return {
            "account_id": account_id,
            "success": ok,
            "message": message,
            "status": account.status if account else "",
            "connectivity_status": account.connectivity_status if account else ConnectivityStatus.UNKNOWN,
            "last_connectivity_check_at": (
                account.last_login_check_at.isoformat(timespec="seconds")
                if account and account.last_login_check_at
                else None
            ),
        }

    def run_token_refresh_task(
        self,
        progress_callback: Callable[[TaskProgress], None] | None = None,
    ) -> int:
        task_id = self._create_task(TaskType.TOKEN_REFRESH, {})
        self._update_task_status(task_id, TaskStatus.RUNNING)
        success_count = 0
        failure_count = 0
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    accounts.id AS account_id,
                    accounts.email,
                    accounts.password,
                    accounts.client_id_override,
                    tokens.refresh_token
                FROM accounts
                LEFT JOIN tokens ON tokens.account_id = accounts.id
                ORDER BY accounts.id DESC
                """
            ).fetchall()
        for row in rows:
            proxy = self.proxies.next_proxy()
            driver = self._build_driver(row["client_id_override"] or "")
            result = driver.refresh_token(
                row["email"],
                row["password"],
                proxy.server if proxy else None,
                row["refresh_token"] or "",
            )
            if result.success:
                success_count += 1
                self.accounts.save_token(
                    TokenRecord(
                        account_id=int(row["account_id"]),
                        access_token=result.access_token,
                        refresh_token=result.refresh_token,
                        expires_at=result.expires_at,
                        last_refreshed_at=datetime.now(),
                        status=TokenStatus.VALID,
                    )
                )
                if proxy:
                    self.proxies.update_status(proxy.id, ProxyStatus.HEALTHY)
                self._append_log(task_id, "INFO", f"{row['email']} Token 刷新成功", row["email"])
            else:
                failure_count += 1
                if proxy:
                    self.proxies.update_status(proxy.id, ProxyStatus.UNHEALTHY)
                self._append_log(task_id, "ERROR", f"{row['email']} Token 刷新失败", row["email"])
            self._update_task_counts(task_id, success_count, failure_count, "" if result.success else result.message)
            if progress_callback:
                progress_callback(
                    TaskProgress(
                        task_id,
                        TaskType.TOKEN_REFRESH,
                        TaskStatus.RUNNING,
                        success_count,
                        failure_count,
                        result.message,
                        self.get_logs(task_id, 10),
                    )
                )
        self._update_task_status(task_id, TaskStatus.COMPLETED if failure_count == 0 else TaskStatus.FAILED)
        return task_id

    def run_mail_sync_task(
        self,
        *,
        account_id: int | None = None,
        source: MailSource = MailSource.AUTO,
        limit: int = 20,
        unread_only: bool = False,
        progress_callback: Callable[[TaskProgress], None] | None = None,
    ) -> int:
        config_snapshot = {
            "account_id": account_id,
            "source": source,
            "limit": limit,
            "unread_only": unread_only,
        }
        task_id = self._create_task(TaskType.MAIL_SYNC, config_snapshot)
        self._update_task_status(task_id, TaskStatus.RUNNING)
        success_count = 0
        failure_count = 0
        target_ids = {account_id} if account_id is not None else set()
        for account in self._iter_target_accounts(target_ids):
            outcome = self.mail.sync_account(account, source=source, limit=limit, unread_only=unread_only)
            if outcome.success:
                success_count += 1
                self._append_log(
                    task_id,
                    "INFO",
                    f"{account.email} 同步到 {outcome.message_count} 封邮件 ({outcome.source})",
                    account.email,
                )
            else:
                failure_count += 1
                self._append_log(
                    task_id,
                    "ERROR",
                    outcome.latest_error or f"{account.email} 邮件同步失败",
                    account.email,
                )
            self._update_task_counts(
                task_id,
                success_count,
                failure_count,
                "" if outcome.success else outcome.latest_error,
            )
            if progress_callback:
                progress_callback(
                    TaskProgress(
                        task_id,
                        TaskType.MAIL_SYNC,
                        TaskStatus.RUNNING,
                        success_count,
                        failure_count,
                        outcome.latest_error or "邮件同步完成",
                        self.get_logs(task_id, 10),
                    )
                )
        self._update_task_status(task_id, TaskStatus.COMPLETED if failure_count == 0 else TaskStatus.FAILED)
        return task_id

    def _run_single_login_check(self, account_id: int) -> tuple[bool, str]:
        account = self.accounts.get_account(account_id)
        if account is None:
            return False, "账号不存在"
        proxy = self.proxies.next_proxy()
        driver = self._build_driver(account.client_id_override)
        result = driver.verify_login(account.email, account.password, proxy.server if proxy else None)
        account.last_login_check_at = datetime.now()
        if result.success:
            account.status = AccountStatus.ACTIVE
            account.connectivity_status = ConnectivityStatus.CONNECTED
            if proxy:
                self.proxies.update_status(proxy.id, ProxyStatus.HEALTHY)
            message = f"{account.email} 登录校验通过"
        else:
            account.status = AccountStatus.LOGIN_FAILED
            account.connectivity_status = ConnectivityStatus.FAILED
            if proxy:
                self.proxies.update_status(proxy.id, ProxyStatus.UNHEALTHY)
            message = f"{account.email} 登录校验失败"
        self.accounts.upsert_account(account)
        return result.success, message if result.success else result.message or message

    def _iter_target_accounts(self, target_ids: set[int]) -> Iterable:
        accounts = self.accounts.list_accounts()
        if not target_ids:
            return accounts
        return [account for account in accounts if (account.id or 0) in target_ids]

    def _build_driver(self, client_id_override: str = ""):
        settings = self.settings.load()
        if settings.get("use_mock_driver", True):
            return MockAutomationDriver()
        return PlaywrightAutomationDriver(
            PlaywrightOptions(
                executable_path=settings.get("browser_executable_path", ""),
                headless=bool(settings.get("headless", False)),
                timeout_ms=int(settings.get("timeout_ms", 30000)),
                captcha_wait_ms=int(settings.get("captcha_wait_ms", 12000)),
                user_agent=settings.get("user_agent", ""),
                client_id=client_id_override or settings.get("client_id", ""),
                redirect_url=settings.get("redirect_url", ""),
                scopes=settings.get("scopes", []),
            )
        )

    def _create_task(self, task_type: TaskType, config_snapshot: dict) -> int:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO tasks (
                    task_type, config_snapshot, status, success_count, failure_count, started_at, finished_at, latest_error
                ) VALUES (?, ?, ?, 0, 0, ?, NULL, '')
                """,
                (task_type, self.database.encode_json(config_snapshot), TaskStatus.PENDING, self.database.now_iso()),
            )
            return int(cursor.lastrowid)

    def _update_task_status(self, task_id: int, status: TaskStatus) -> None:
        finished_at = (
            self.database.now_iso()
            if status in {TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED}
            else None
        )
        with self.database.connect() as connection:
            connection.execute(
                "UPDATE tasks SET status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?",
                (status, finished_at, task_id),
            )

    def _update_task_counts(self, task_id: int, success_count: int, failure_count: int, latest_error: str) -> None:
        with self.database.connect() as connection:
            connection.execute(
                "UPDATE tasks SET success_count = ?, failure_count = ?, latest_error = ? WHERE id = ?",
                (success_count, failure_count, latest_error, task_id),
            )

    def _append_log(self, task_id: int, level: str, message: str, account_email: str = "") -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO task_logs (task_id, level, message, account_email, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (task_id, level, message, account_email, self.database.now_iso()),
            )

    def _random_registration_payload(self) -> RegistrationPayload:
        token = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(12))
        return RegistrationPayload(
            email=token,
            password=self._random_password(),
            first_name="Auto",
            last_name="Manager",
            birth_year=random.randint(1988, 2002),
            birth_month=random.randint(1, 12),
            birth_day=random.randint(1, 28),
        )

    def _random_password(self) -> str:
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        while True:
            password = "".join(random.choice(chars) for _ in range(12))
            if (
                any(c.islower() for c in password)
                and any(c.isupper() for c in password)
                and any(c.isdigit() for c in password)
            ):
                return password
