from __future__ import annotations

import base64
import email
import html
import imaplib
import json
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests

from outlook_batch_manager.models import (
    Account,
    ConnectivityStatus,
    MailCapabilityStatus,
    MailSource,
    MailSyncRun,
    MessageRecord,
    TaskStatus,
    TokenRecord,
    TokenStatus,
)
from outlook_batch_manager.services.account_service import AccountService
from outlook_batch_manager.services.settings_service import SettingsService
from outlook_batch_manager.storage.database import Database


@dataclass(slots=True)
class MailSyncOutcome:
    account_id: int
    account_email: str
    source: MailSource
    success: bool
    message_count: int = 0
    latest_error: str = ""


class MailService:
    def __init__(self, database: Database, accounts: AccountService, settings: SettingsService) -> None:
        self.database = database
        self.accounts = accounts
        self.settings = settings
        self.session_path = database.path.parent / "oauth_sessions.json"

    def create_auth_session(self, account_id: int) -> dict[str, Any]:
        account = self.accounts.get_account(account_id)
        if account is None:
            raise RuntimeError("账号不存在。")
        settings = self.settings.load()
        client_id = (account.client_id_override or settings["oauth"]["client_id"]).strip()
        redirect_uri = settings["oauth"]["redirect_uri"].strip()
        scopes = [item.strip() for item in settings["oauth"]["scopes"] if item.strip()]
        if not client_id or not redirect_uri:
            raise RuntimeError("请先在设置中配置 OAuth Client ID 和 Redirect URI。")

        session_id = secrets.token_urlsafe(18)
        state = secrets.token_urlsafe(18)
        code_verifier = secrets.token_urlsafe(48)
        session = {
            "session_id": session_id,
            "account_id": account_id,
            "state": state,
            "client_id": client_id,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
            "scopes": scopes,
            "created_at": self.database.now_iso(),
        }
        self._save_session(session)
        query = urlencode(
            {
                "client_id": client_id,
                "response_type": "code",
                "redirect_uri": redirect_uri,
                "response_mode": "query",
                "scope": " ".join(scopes),
                "state": state,
                "prompt": "select_account",
                "code_challenge": self._generate_code_challenge(code_verifier),
                "code_challenge_method": "S256",
            }
        )
        return {
            "session_id": session_id,
            "state": state,
            "redirect_uri": redirect_uri,
            "authorization_url": f"https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?{query}",
        }

    def complete_oauth(self, session_id: str, code: str, state: str) -> dict[str, Any]:
        session = self._load_session(session_id)
        if session is None:
            raise RuntimeError("授权会话不存在或已过期。")
        if session["state"] != state:
            raise RuntimeError("授权状态校验失败。")
        payload = requests.post(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            data={
                "client_id": session["client_id"],
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": session["redirect_uri"],
                "code_verifier": session["code_verifier"],
                "scope": " ".join(session["scopes"]),
            },
            timeout=30,
        ).json()
        access_token = payload.get("access_token", "")
        refresh_token = payload.get("refresh_token", "")
        if not access_token or not refresh_token:
            raise RuntimeError(self._format_token_error(payload))

        account = self.accounts.get_account(int(session["account_id"]))
        if account is None:
            raise RuntimeError("授权目标账号不存在。")
        account.client_id_override = session["client_id"]
        self.accounts.upsert_account(account)
        self.accounts.save_token(
            TokenRecord(
                account_id=account.id or 0,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=datetime.now() + timedelta(seconds=int(payload.get("expires_in", 3600))),
                last_refreshed_at=datetime.now(),
                status=TokenStatus.VALID,
            )
        )
        self.accounts.update_account_runtime(
            account.id or 0,
            connectivity_status=ConnectivityStatus.CONNECTABLE,
            mail_capability_status=MailCapabilityStatus.NOT_READY,
            last_login_check_at=datetime.now(),
            last_error="",
        )
        self._delete_session(session_id)
        return {"account_id": account.id, "email_address": account.email}

    def list_messages(
        self,
        *,
        account_id: int | None = None,
        keyword: str = "",
        unread_only: bool = False,
        source: str = "",
    ) -> list[dict[str, Any]]:
        sql = """
            SELECT
                messages.*,
                accounts.email AS account_email,
                accounts.group_name AS account_group_name
            FROM messages
            INNER JOIN accounts ON accounts.id = messages.account_id
        """
        conditions: list[str] = []
        params: list[Any] = []
        if account_id is not None:
            conditions.append("messages.account_id = ?")
            params.append(account_id)
        if keyword:
            conditions.append("(messages.subject LIKE ? OR messages.from_address LIKE ? OR messages.snippet LIKE ?)")
            term = f"%{keyword}%"
            params.extend([term, term, term])
        if unread_only:
            conditions.append("messages.is_read = 0")
        if source:
            conditions.append("messages.source = ?")
            params.append(source)
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY messages.received_at DESC, messages.id DESC LIMIT 200"
        with self.database.connect() as connection:
            rows = connection.execute(sql, tuple(params)).fetchall()
        return [
            {
                "id": int(row["id"]),
                "account_id": int(row["account_id"]),
                "account_email": row["account_email"],
                "account_group_name": row["account_group_name"] or "",
                "source": row["source"],
                "message_id": row["message_id"],
                "internet_message_id": row["internet_message_id"],
                "folder_name": row["folder_name"],
                "subject": row["subject"],
                "from_address": row["from_address"],
                "to_address": row["to_address"],
                "received_at": row["received_at"],
                "is_read": bool(row["is_read"]),
                "has_attachments": bool(row["has_attachments"]),
                "snippet": row["snippet"],
                "raw_payload": row["raw_payload"],
                "synced_at": row["synced_at"],
            }
            for row in rows
        ]

    def list_sync_runs(self, limit: int = 20) -> list[MailSyncRun]:
        with self.database.connect() as connection:
            rows = connection.execute("SELECT * FROM mail_sync_runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [
            MailSyncRun(
                id=int(row["id"]),
                account_id=int(row["account_id"]) if row["account_id"] is not None else None,
                source=MailSource(row["source"]),
                status=TaskStatus(row["status"]),
                message_count=int(row["message_count"]),
                latest_error=row["latest_error"],
                started_at=self._parse_datetime(row["started_at"]),
                finished_at=self._parse_datetime(row["finished_at"]),
            )
            for row in rows
        ]

    def summarize(self) -> dict[str, Any]:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT
                    COUNT(*) AS total_messages,
                    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_messages
                FROM messages
                """
            ).fetchone()
        latest_run = self.list_sync_runs(1)
        return {
            "total_messages": int(row["total_messages"] or 0),
            "unread_messages": int(row["unread_messages"] or 0),
            "latest_run": self._serialize_run(latest_run[0]) if latest_run else None,
        }

    def test_account_capability(self, account_id: int) -> dict[str, Any]:
        account = self.accounts.get_account(account_id)
        token = self.accounts.get_token(account_id)
        if account is None:
            raise RuntimeError("账号不存在。")
        if self.settings.load().get("mock_mode", False):
            self.accounts.update_account_runtime(
                account_id,
                connectivity_status=ConnectivityStatus.CONNECTED,
                mail_capability_status=MailCapabilityStatus.RECEIVE_ONLY,
                last_login_check_at=datetime.now(),
                last_error="",
            )
            return {
                "account_id": account_id,
                "success": True,
                "mail_capability_status": MailCapabilityStatus.RECEIVE_ONLY,
                "connectivity_status": ConnectivityStatus.CONNECTED,
                "message": "Mock 模式下已通过 IMAP 收件检测。",
                "stages": {"token": True, "imap": True},
            }
        if not account.client_id_override or token is None or not token.refresh_token:
            message = "账号缺少 client_id 或 refresh_token，暂不具备联通条件。"
            self.accounts.update_account_runtime(
                account_id,
                connectivity_status=ConnectivityStatus.ACTION_REQUIRED,
                mail_capability_status=MailCapabilityStatus.NOT_READY,
                last_login_check_at=datetime.now(),
                last_error=message,
            )
            return {
                "account_id": account_id,
                "success": False,
                "mail_capability_status": MailCapabilityStatus.NOT_READY,
                "connectivity_status": ConnectivityStatus.ACTION_REQUIRED,
                "message": message,
                "stages": {"token": False, "imap": False},
            }

        access_token = ""
        token_ok = False
        imap_ok = False
        error = ""
        try:
            access_token = self._ensure_access_token(account, token)
            token_ok = True
        except Exception as exc:
            error = str(exc)

        if token_ok:
            try:
                self._test_imap_login(account.email, access_token)
                imap_ok = True
            except Exception as exc:
                error = str(exc)

        status = ConnectivityStatus.CONNECTED if token_ok and imap_ok else ConnectivityStatus.FAILED
        capability = MailCapabilityStatus.RECEIVE_ONLY if token_ok and imap_ok else MailCapabilityStatus.NOT_READY
        message = "账号已具备 IMAP 收件能力。" if token_ok and imap_ok else error
        self.accounts.update_account_runtime(
            account_id,
            connectivity_status=status,
            mail_capability_status=capability,
            last_login_check_at=datetime.now(),
            last_error="" if token_ok and imap_ok else message,
        )
        return {
            "account_id": account_id,
            "success": token_ok and imap_ok,
            "mail_capability_status": capability,
            "connectivity_status": status,
            "message": message,
            "stages": {"token": token_ok, "imap": imap_ok},
        }

    def sync_account(
        self,
        account: Account | int,
        *,
        source: MailSource = MailSource.AUTO,
        limit: int = 20,
        unread_only: bool = False,
    ) -> MailSyncOutcome:
        target = account if isinstance(account, Account) else self.accounts.get_account(account)
        if target is None or target.id is None:
            raise RuntimeError("账号不存在。")
        run_id = self._create_sync_run(target.id, MailSource.MOCK if self._use_mock(source) else MailSource.IMAP)
        try:
            if self._use_mock(source):
                messages = self._mock_messages(target, limit)
                stored = self._store_messages(messages)
            else:
                token = self.accounts.get_token(target.id)
                if token is None or not token.refresh_token or not target.client_id_override:
                    raise RuntimeError("账号缺少 IMAP OAuth 凭证，无法同步收件。")
                access_token = self._ensure_access_token(target, token)
                messages = self._fetch_imap_messages(target.email, access_token, limit, unread_only)
                stored = self._store_messages(messages)
            self.accounts.update_account_runtime(
                target.id,
                connectivity_status=ConnectivityStatus.CONNECTED,
                mail_capability_status=MailCapabilityStatus.RECEIVE_ONLY,
                last_login_check_at=datetime.now(),
                last_mail_sync_at=datetime.now(),
                last_error="",
            )
            self._finish_sync_run(run_id, TaskStatus.COMPLETED, stored, "")
            return MailSyncOutcome(
                account_id=target.id,
                account_email=target.email,
                source=MailSource.MOCK if self._use_mock(source) else MailSource.IMAP,
                success=True,
                message_count=stored,
            )
        except Exception as exc:
            self.accounts.update_account_runtime(
                target.id,
                connectivity_status=ConnectivityStatus.FAILED,
                mail_capability_status=MailCapabilityStatus.NOT_READY,
                last_login_check_at=datetime.now(),
                last_error=str(exc),
            )
            self._finish_sync_run(run_id, TaskStatus.FAILED, 0, str(exc))
            return MailSyncOutcome(
                account_id=target.id,
                account_email=target.email,
                source=MailSource.IMAP,
                success=False,
                latest_error=str(exc),
            )

    def sync_accounts(self, account_ids: list[int], limit: int | None = None, unread_only: bool = False) -> dict[str, Any]:
        results: list[dict[str, Any]] = []
        success = 0
        failed = 0
        batch_limit = limit or int(self.settings.load()["mail"]["sync_batch_size"])
        for account_id in account_ids:
            outcome = self.sync_account(account_id, limit=batch_limit, unread_only=unread_only)
            results.append(
                {
                    "account_id": account_id,
                    "success": outcome.success,
                    "message_count": outcome.message_count,
                    "latest_error": outcome.latest_error,
                }
            )
            if outcome.success:
                success += 1
            else:
                failed += 1
        return {"success": success, "failed": failed, "results": results}

    def sync_due_accounts(self) -> dict[str, Any]:
        settings = self.settings.load()
        interval_minutes = max(1, int(settings["mail"]["poll_interval_minutes"]))
        batch_limit = int(settings["mail"]["sync_batch_size"])
        now = datetime.now()
        due_ids: list[int] = []
        for account in self.accounts.list_accounts():
            if account.id is None or account.connectivity_status != ConnectivityStatus.CONNECTED:
                continue
            if account.last_mail_sync_at is None or (now - account.last_mail_sync_at) >= timedelta(minutes=interval_minutes):
                due_ids.append(account.id)
        if not due_ids:
            return {"success": 0, "failed": 0, "results": [], "skipped": 0, "scheduled": 0}
        result = self.sync_accounts(due_ids, limit=batch_limit)
        result["scheduled"] = len(due_ids)
        result["skipped"] = 0
        return result

    def _use_mock(self, source: MailSource) -> bool:
        return self.settings.load().get("mock_mode", False) or source == MailSource.MOCK

    def _ensure_access_token(self, account: Account, token: TokenRecord) -> str:
        if token.expires_at and token.expires_at > datetime.now() + timedelta(minutes=5) and token.access_token:
            return token.access_token
        if not token.refresh_token:
            raise RuntimeError("缺少 refresh_token，请先补充 IMAP OAuth 授权。")
        client_id = (account.client_id_override or self.settings.load()["oauth"]["client_id"]).strip()
        if not client_id:
            raise RuntimeError("缺少 client_id，请先补充 IMAP OAuth 授权。")
        response = requests.post(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            data={
                "client_id": client_id,
                "grant_type": "refresh_token",
                "refresh_token": token.refresh_token,
                "redirect_uri": self.settings.load()["oauth"]["redirect_uri"],
                "scope": "https://outlook.office.com/.default",
            },
            timeout=30,
        )
        payload = response.json()
        access_token = payload.get("access_token", "")
        if response.status_code >= 400 or not access_token:
            token.status = TokenStatus.FAILED
            self.accounts.save_token(token)
            raise RuntimeError(self._format_token_error(payload))
        token.access_token = access_token
        token.refresh_token = payload.get("refresh_token", token.refresh_token)
        token.expires_at = datetime.now() + timedelta(seconds=int(payload.get("expires_in", 3600)))
        token.last_refreshed_at = datetime.now()
        token.status = TokenStatus.VALID
        self.accounts.save_token(token)
        return token.access_token

    def _test_imap_login(self, email_address: str, access_token: str) -> None:
        client = self._open_imap_client(email_address, access_token)
        try:
            status, _ = client.select("INBOX", readonly=True)
            if status != "OK":
                raise RuntimeError("IMAP 已登录，但无法打开 Inbox。")
        finally:
            try:
                client.logout()
            except Exception:
                pass

    def _fetch_imap_messages(self, email_address: str, access_token: str, limit: int, unread_only: bool) -> list[MessageRecord]:
        client = self._open_imap_client(email_address, access_token)
        try:
            status, _ = client.select("INBOX", readonly=True)
            if status != "OK":
                raise RuntimeError("无法打开 Inbox。")
            criteria = "UNSEEN" if unread_only else "ALL"
            status, data = client.search(None, criteria)
            if status != "OK":
                raise RuntimeError("IMAP 搜索邮件失败。")
            message_ids = data[0].split()[-limit:]
            records: list[MessageRecord] = []
            for item in reversed(message_ids):
                status, fetched = client.fetch(item, "(RFC822 FLAGS)")
                if status != "OK" or not fetched:
                    continue
                raw_message = next((part[1] for part in fetched if isinstance(part, tuple) and len(part) > 1), b"")
                if not raw_message:
                    continue
                parsed = email.message_from_bytes(raw_message)
                message_id = (parsed.get("Message-ID") or item.decode("utf-8", errors="ignore")).strip()
                records.append(
                    MessageRecord(
                        account_id=self.accounts.get_account_by_email(email_address).id or 0,
                        source=MailSource.IMAP,
                        message_id=message_id,
                        internet_message_id=message_id,
                        folder_name="Inbox",
                        subject=self._decode_mime_header(parsed.get("Subject", "")),
                        from_address=self._decode_mime_header(parsed.get("From", "")),
                        to_address=self._decode_mime_header(parsed.get("To", "")),
                        received_at=self._parse_email_datetime(parsed.get("Date")),
                        is_read=self._is_seen_flag(fetched),
                        has_attachments=self._has_attachments(parsed),
                        snippet=self._extract_snippet(parsed),
                        raw_payload=self._decode_bytes(raw_message),
                        synced_at=datetime.now(),
                    )
                )
            return records
        finally:
            try:
                client.logout()
            except Exception:
                pass

    def _open_imap_client(self, email_address: str, access_token: str) -> imaplib.IMAP4_SSL:
        imap_settings = self.settings.load()["mail_protocols"]["imap"]
        if not imap_settings.get("enabled", True):
            raise RuntimeError("IMAP 协议未启用，请先到设置页开启。")
        host = imap_settings["host"]
        port = int(imap_settings["port"])
        if not imap_settings.get("use_ssl", True):
            raise RuntimeError("当前版本仅支持 IMAP SSL。")
        client = imaplib.IMAP4_SSL(host, port)
        auth_string = f"user={email_address}\x01auth=Bearer {access_token}\x01\x01"
        try:
            client.authenticate("XOAUTH2", lambda _: auth_string.encode("utf-8"))
        except imaplib.IMAP4.error as exc:
            raise RuntimeError(f"IMAP OAuth 登录失败：{exc}") from exc
        return client

    def _store_messages(self, records: list[MessageRecord]) -> int:
        stored = 0
        with self.database.connect() as connection:
            for record in records:
                connection.execute(
                    """
                    INSERT INTO messages (
                        account_id, source, message_id, internet_message_id, folder_name, subject,
                        from_address, to_address, received_at, is_read, has_attachments, snippet, raw_payload, synced_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(account_id, source, message_id) DO UPDATE SET
                        internet_message_id = excluded.internet_message_id,
                        folder_name = excluded.folder_name,
                        subject = excluded.subject,
                        from_address = excluded.from_address,
                        to_address = excluded.to_address,
                        received_at = excluded.received_at,
                        is_read = excluded.is_read,
                        has_attachments = excluded.has_attachments,
                        snippet = excluded.snippet,
                        raw_payload = excluded.raw_payload,
                        synced_at = excluded.synced_at
                    """,
                    (
                        record.account_id,
                        record.source,
                        record.message_id,
                        record.internet_message_id,
                        record.folder_name,
                        record.subject,
                        record.from_address,
                        record.to_address,
                        self._serialize_datetime(record.received_at),
                        1 if record.is_read else 0,
                        1 if record.has_attachments else 0,
                        record.snippet,
                        record.raw_payload,
                        self._serialize_datetime(record.synced_at) or self.database.now_iso(),
                    ),
                )
                stored += 1
        return stored

    def _create_sync_run(self, account_id: int | None, source: MailSource) -> int:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO mail_sync_runs (account_id, source, status, message_count, latest_error, started_at, finished_at)
                VALUES (?, ?, ?, 0, '', ?, NULL)
                """,
                (account_id, source, TaskStatus.RUNNING, self.database.now_iso()),
            )
            return int(cursor.lastrowid)

    def _finish_sync_run(self, run_id: int, status: TaskStatus, message_count: int, latest_error: str) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE mail_sync_runs
                SET status = ?, message_count = ?, latest_error = ?, finished_at = ?
                WHERE id = ?
                """,
                (status, message_count, latest_error, self.database.now_iso(), run_id),
            )

    def _mock_messages(self, account: Account, limit: int) -> list[MessageRecord]:
        now = datetime.now()
        return [
            MessageRecord(
                account_id=account.id or 0,
                source=MailSource.MOCK,
                message_id=f"mock-{account.id}-{index}",
                internet_message_id=f"<mock-{account.id}-{index}@local>",
                folder_name="Inbox",
                subject=f"Mock 邮件 #{index + 1}",
                from_address="demo@local.test",
                to_address=account.email,
                received_at=now - timedelta(minutes=index * 4),
                is_read=index % 2 == 0,
                has_attachments=False,
                snippet="这是一封用于调试界面的模拟邮件。",
                raw_payload=json.dumps({"mock": True, "index": index}, ensure_ascii=False),
                synced_at=now,
            )
            for index in range(limit)
        ]

    def _load_sessions(self) -> dict[str, dict[str, Any]]:
        if not self.session_path.exists():
            return {}
        return json.loads(self.session_path.read_text(encoding="utf-8"))

    def _save_session(self, session: dict[str, Any]) -> None:
        sessions = self._load_sessions()
        sessions[session["session_id"]] = session
        self.session_path.write_text(json.dumps(sessions, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_session(self, session_id: str) -> dict[str, Any] | None:
        return self._load_sessions().get(session_id)

    def _delete_session(self, session_id: str) -> None:
        sessions = self._load_sessions()
        sessions.pop(session_id, None)
        self.session_path.write_text(json.dumps(sessions, ensure_ascii=False, indent=2), encoding="utf-8")

    @staticmethod
    def _generate_code_challenge(code_verifier: str) -> str:
        digest = __import__("hashlib").sha256(code_verifier.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")

    @staticmethod
    def _format_token_error(payload: dict[str, Any]) -> str:
        error = payload.get("error", "")
        description = payload.get("error_description", "")
        if error == "invalid_grant":
            return "Token 刷新失败：refresh_token 无效、已过期，或当前 client_id 未获得 Outlook IMAP 授权。"
        if description:
            return f"Token 刷新失败：{description}"
        return f"Token 刷新失败：{payload}"

    @staticmethod
    def _decode_mime_header(value: str) -> str:
        try:
            parts: list[str] = []
            for fragment, charset in decode_header(value):
                if isinstance(fragment, bytes):
                    parts.append(MailService._decode_bytes(fragment, charset))
                else:
                    parts.append(fragment)
            text = "".join(parts).strip()
            return text or str(make_header(decode_header(value)))
        except Exception:
            return value or ""

    @staticmethod
    def _parse_email_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is not None:
                return parsed.astimezone().replace(tzinfo=None)
            return parsed
        except Exception:
            return None

    @staticmethod
    def _extract_snippet(message: email.message.Message) -> str:
        if message.is_multipart():
            for part in message.walk():
                if part.get_content_maintype() == "multipart":
                    continue
                disposition = (part.get("Content-Disposition") or "").lower()
                if "attachment" in disposition:
                    continue
                if part.get_content_type() in {"text/plain", "text/html"}:
                    payload = part.get_payload(decode=True) or b""
                    text = MailService._decode_bytes(payload, part.get_content_charset())
                    if part.get_content_type() == "text/html":
                        text = MailService._html_to_text(text)
                    return " ".join(text.split())[:200]
        payload = message.get_payload(decode=True) or b""
        return " ".join(MailService._decode_bytes(payload).split())[:200]

    @staticmethod
    def _decode_bytes(value: bytes, charset: str | None = None) -> str:
        preferred = [charset] if charset else []
        fallbacks = [
            "utf-8",
            "gb18030",
            "gbk",
            "gb2312",
            "big5",
            "iso-8859-1",
        ]
        for encoding in [item for item in preferred + fallbacks if item]:
            try:
                return value.decode(encoding)
            except Exception:
                continue
        return value.decode("utf-8", errors="replace")

    @staticmethod
    def _html_to_text(value: str) -> str:
        text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", value)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        return html.unescape(text)

    @staticmethod
    def _has_attachments(message: email.message.Message) -> bool:
        return any(part.get_filename() for part in message.walk())

    @staticmethod
    def _is_seen_flag(fetched: list[Any]) -> bool:
        for part in fetched:
            if isinstance(part, tuple):
                meta = part[0]
                if isinstance(meta, bytes) and b"FLAGS" in meta:
                    return b"\\Seen" in meta
        return False

    @staticmethod
    def _serialize_datetime(value: datetime | None) -> str | None:
        return value.isoformat(timespec="seconds") if value else None

    @staticmethod
    def _parse_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        return datetime.fromisoformat(value)

    def _serialize_run(self, run: MailSyncRun) -> dict[str, Any]:
        return {
            "id": run.id,
            "account_id": run.account_id,
            "source": run.source,
            "status": run.status,
            "message_count": run.message_count,
            "latest_error": run.latest_error,
            "started_at": self._serialize_datetime(run.started_at),
            "finished_at": self._serialize_datetime(run.finished_at),
        }
