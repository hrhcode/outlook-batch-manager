from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta

from imapclient import exceptions as imap_exceptions
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.core.config import Settings
from backend.app.db.database import SessionLocal
from backend.app.db.models import Account, MailMessage, MailboxState
from backend.app.schemas.accounts import AccountTestResult
from backend.app.services.auth import AccessTokenBundle, AuthError, OutlookOAuthService
from backend.app.services.event_bus import EventBus
from backend.app.services.imap_sync import FetchedMessage, OutlookImapService, SyncError, SyncOutcome


@dataclass(slots=True)
class SyncDependencies:
    settings: Settings
    auth_service: OutlookOAuthService
    imap_service: OutlookImapService
    event_bus: EventBus


class AccountSyncService:
    def __init__(self, dependencies: SyncDependencies, enabled: bool = True) -> None:
        self.settings = dependencies.settings
        self.auth_service = dependencies.auth_service
        self.imap_service = dependencies.imap_service
        self.event_bus = dependencies.event_bus
        self.enabled = enabled
        self._stop_event = asyncio.Event()
        self._tasks: dict[int, asyncio.Task[None]] = {}
        self._locks: defaultdict[int, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._action_locks: defaultdict[int, asyncio.Lock] = defaultdict(asyncio.Lock)

    async def start(self) -> None:
        if not self.enabled:
            return
        with SessionLocal() as session:
            account_ids = list(session.scalars(select(Account.id)))
        for account_id in account_ids:
            self.ensure_worker(account_id)

    async def stop(self) -> None:
        if not self.enabled:
            return
        self._stop_event.set()
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks.clear()

    def ensure_worker(self, account_id: int) -> None:
        if not self.enabled:
            return
        task = self._tasks.get(account_id)
        if task and not task.done():
            return
        self._tasks[account_id] = asyncio.create_task(self._worker_loop(account_id))

    async def test_account(self, account_id: int) -> AccountTestResult:
        async with self._action_locks[account_id]:
            with SessionLocal() as session:
                account = session.get(Account, account_id)
                if not account:
                    raise ValueError("Account not found.")
                self._mark_connecting(account)
                session.commit()
                await self.event_bus.publish(
                    "account_status_changed",
                    self._build_status_payload(account, "test", "connecting")
                )

                token_bundle = await self._get_valid_access_token(account)
                account.access_token = token_bundle.access_token
                account.access_token_expires_at = token_bundle.expires_at
                result = await self.imap_service.test_connection(account, token_bundle.access_token)
                account.last_test_status = "success"
                account.account_status = "connected"
                account.last_error = None
                session.commit()
                success_payload = self._build_status_payload(account, "test", "success")

            payload = AccountTestResult(
                id=account_id,
                status="success",
                message=result.message,
                tested_at=datetime.utcnow()
            )
            await self.event_bus.publish("account_status_changed", success_payload)
            return payload

    async def test_account_with_error_handling(self, account_id: int) -> AccountTestResult:
        try:
            return await self.test_account(account_id)
        except (AuthError, SyncError, ValueError) as error:
            with SessionLocal() as session:
                account = session.get(Account, account_id)
                if not account:
                    raise
                account.last_test_status = "failed"
                account.account_status = "disconnected"
                account.last_error = str(error)
                session.commit()
                failure_payload = self._build_status_payload(account, "test", "failed", str(error))

            payload = AccountTestResult(
                id=account_id,
                status="failed",
                message=str(error),
                tested_at=datetime.utcnow()
            )
            await self.event_bus.publish("account_status_changed", failure_payload)
            return payload
        finally:
            self.ensure_worker(account_id)

    async def _worker_loop(self, account_id: int) -> None:
        backoff_index = 0
        while not self._stop_event.is_set():
            try:
                async with self._locks[account_id]:
                    outcome = await self._sync_account(account_id)
                backoff_index = 0
                delay = 5 if outcome.idle_supported else self.settings.fallback_poll_seconds
                await self._wait(delay)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                schedule = self.settings.backoff_schedule
                delay = schedule[min(backoff_index, len(schedule) - 1)]
                backoff_index = min(backoff_index + 1, len(schedule) - 1)
                with SessionLocal() as session:
                    account = session.get(Account, account_id)
                    failure_payload = self._build_status_payload(None, "sync", "failed", str(error), account_id=account_id)
                    if account:
                        account.account_status = "disconnected"
                        account.last_error = str(error)
                        mailbox_state = self._get_or_create_mailbox_state(session, account)
                        mailbox_state.backoff_seconds = delay
                        mailbox_state.fallback_mode = "poll"
                        session.commit()
                        failure_payload = self._build_status_payload(account, "sync", "failed", str(error))
                await self.event_bus.publish("account_status_changed", failure_payload)
                await self._wait(delay)

    async def _sync_account(self, account_id: int) -> SyncOutcome:
        with SessionLocal() as session:
            account = session.get(Account, account_id)
            if not account:
                raise ValueError("Account not found.")
            mailbox_state = self._get_or_create_mailbox_state(session, account)
            if account.account_status != "connected":
                self._mark_connecting(account)
                session.commit()
                await self.event_bus.publish(
                    "account_status_changed",
                    self._build_status_payload(account, "sync", "connecting")
                )
            token_bundle = await self._get_valid_access_token(account)
            account.access_token = token_bundle.access_token
            account.access_token_expires_at = token_bundle.expires_at
            session.commit()
            try:
                outcome = await self.imap_service.sync_inbox(account, mailbox_state, token_bundle.access_token)
            except Exception as error:
                if self._is_transient_idle_exit(error, mailbox_state):
                    outcome = SyncOutcome(
                        uidvalidity=mailbox_state.uidvalidity or "0",
                        last_uid=mailbox_state.last_uid,
                        idle_supported=True,
                        idle_triggered=False,
                        idle_cycle_renewed=True,
                        messages=[]
                    )
                else:
                    raise

        with SessionLocal() as session:
            account = session.get(Account, account_id)
            if not account:
                raise ValueError("Account not found.")
            mailbox_state = self._get_or_create_mailbox_state(session, account)
            inserted = self._upsert_messages(session, account, outcome.messages)
            mailbox_state.uidvalidity = outcome.uidvalidity
            mailbox_state.last_uid = outcome.last_uid
            mailbox_state.last_synced_at = datetime.utcnow()
            mailbox_state.last_idle_restart_at = datetime.utcnow() if outcome.idle_supported else None
            mailbox_state.idle_supported = outcome.idle_supported
            mailbox_state.fallback_mode = "idle" if outcome.idle_supported else "poll"
            mailbox_state.backoff_seconds = 0
            account.account_status = "connected"
            account.last_error = None
            account.message_count = session.scalar(
                select(func.count(MailMessage.id)).where(MailMessage.account_id == account.id)
            ) or 0
            session.commit()
            success_payload = self._build_status_payload(account, "sync", "success")

        if inserted:
            await self.event_bus.publish(
                "mail_received",
                {
                    "account_id": account_id,
                    "count": inserted,
                    "last_uid": outcome.last_uid
                }
            )

        await self.event_bus.publish("account_status_changed", success_payload)
        return outcome

    def _upsert_messages(self, session: Session, account: Account, messages: list[FetchedMessage]) -> int:
        inserted = 0
        for payload in messages:
            existing = session.scalar(
                select(MailMessage).where(
                    MailMessage.account_id == account.id,
                    MailMessage.folder == payload.folder,
                    MailMessage.uidvalidity == payload.uidvalidity,
                    MailMessage.uid == payload.uid
                )
            )

            if existing:
                existing.subject = payload.subject
                existing.sender = payload.sender
                existing.snippet = payload.snippet
                existing.body_text = payload.body_text
                existing.body_html = payload.body_html
                existing.recipients = payload.recipients
                existing.is_unread = payload.is_unread
                existing.received_at = payload.received_at
                existing.synced_at = datetime.utcnow()
                continue

            session.add(
                MailMessage(
                    account_id=account.id,
                    folder=payload.folder,
                    uidvalidity=payload.uidvalidity,
                    uid=payload.uid,
                    message_id=payload.message_id,
                    subject=payload.subject,
                    sender=payload.sender,
                    from_name=payload.from_name,
                    recipients=payload.recipients,
                    snippet=payload.snippet,
                    body_text=payload.body_text,
                    body_html=payload.body_html,
                    is_unread=payload.is_unread,
                    received_at=payload.received_at
                )
            )
            inserted += 1

        session.flush()
        return inserted

    def _get_or_create_mailbox_state(self, session: Session, account: Account) -> MailboxState:
        mailbox_state = session.scalar(select(MailboxState).where(MailboxState.account_id == account.id))
        if mailbox_state:
            return mailbox_state

        mailbox_state = MailboxState(account_id=account.id, folder="INBOX")
        session.add(mailbox_state)
        session.flush()
        return mailbox_state

    async def _get_valid_access_token(self, account: Account) -> AccessTokenBundle:
        expires_at = account.access_token_expires_at
        if account.access_token and expires_at:
            refresh_deadline = datetime.utcnow() + timedelta(seconds=self.settings.token_refresh_leeway_seconds)
            if expires_at > refresh_deadline:
                return AccessTokenBundle(
                    access_token=account.access_token,
                    expires_at=expires_at,
                    refreshed=False
                )
        return await self.auth_service.refresh_access_token(account)

    def _resolve_sync_mode(self, account: Account | None) -> str | None:
        if account is None or account.mailbox_state is None or account.mailbox_state.last_synced_at is None:
            return None
        if account.mailbox_state.fallback_mode == "idle":
            return "idle"
        if account.mailbox_state.fallback_mode == "poll":
            return "poll"
        return None

    def _build_status_payload(
        self,
        account: Account | None,
        kind: str,
        status: str,
        message: str | None = None,
        account_id: int | None = None
    ) -> dict[str, object]:
        payload: dict[str, object] = {
            "account_id": account.id if account is not None else account_id,
            "status": status,
            "kind": kind,
            "sync_mode": self._resolve_sync_mode(account),
            "last_synced_at": account.mailbox_state.last_synced_at.isoformat() if account and account.mailbox_state and account.mailbox_state.last_synced_at else None,
        }
        if message is not None:
            payload["message"] = message
        return payload

    def _is_transient_idle_exit(self, error: Exception, mailbox_state: MailboxState) -> bool:
        if mailbox_state.last_synced_at is None or not mailbox_state.idle_supported:
            return False

        transient_errors = (
            TimeoutError,
            OSError,
            ConnectionError,
            imap_exceptions.IMAPClientAbortError,
            imap_exceptions.IllegalStateError,
            imap_exceptions.ProtocolError,
        )
        if isinstance(error, transient_errors):
            return True

        message = str(error).lower()
        return "idle" in message and ("timeout" in message or "close" in message or "abort" in message or "reset" in message)

    async def _wait(self, seconds: int) -> None:
        try:
            await asyncio.wait_for(self._stop_event.wait(), timeout=seconds)
        except asyncio.TimeoutError:
            return

    async def _stop_worker(self, account_id: int) -> None:
        if not self.enabled:
            return
        task = self._tasks.get(account_id)
        if not task or task.done():
            self._tasks.pop(account_id, None)
            return
        if task is asyncio.current_task():
            return
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        if self._tasks.get(account_id) is task:
            self._tasks.pop(account_id, None)

    def _mark_connecting(self, account: Account) -> None:
        account.account_status = "connecting"
        account.updated_at = datetime.utcnow()
