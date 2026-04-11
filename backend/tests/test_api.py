from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient
from imapclient import exceptions as imap_exceptions
import pytest
from sqlalchemy import select

from backend.app.core.config import Settings
from backend.app.db.database import SessionLocal
from backend.app.db.models import Account, MailMessage, MailboxState
from backend.app.main import create_app
from backend.app.services import imap_sync
from backend.app.services.auth import AccessTokenBundle
from backend.app.services.event_bus import EventBus
from backend.app.services.imap_sync import FetchedMessage, OutlookImapService, SyncOutcome
from backend.app.services.sync_service import AccountSyncService, SyncDependencies


def make_settings(tmp_path: Path) -> Settings:
    return Settings(
        port=8765,
        desktop_token="test-token",
        data_dir=tmp_path,
    )


def test_import_endpoint_overwrites_existing_account(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)

    with TestClient(app) as client:
        headers = {"X-Desktop-Token": "test-token"}
        client.post(
            "/accounts",
            headers=headers,
            json={
                "email": "alpha@outlook.com",
                "password": "before",
                "client_id": "client-1",
                "refresh_token": "token-1",
            },
        )
        response = client.post(
            "/accounts/import-file",
            headers=headers,
            files={"file": ("accounts.txt", "alpha@outlook.com----after----client-2----token-2", "text/plain")},
        )

        payload = response.json()
        assert payload["imported"] == 0
        assert payload["updated"] == 1
        assert payload["failures"] == []

        exported = client.get("/accounts/export?ids=1", headers=headers)
        assert "alpha@outlook.com----after----client-2----token-2" in exported.text
        accounts = client.get("/accounts", headers=headers).json()
        assert accounts[0]["account_status"] == "disconnected"
        assert accounts[0]["access_token"] is None


def test_event_bus_delivers_mail_received_payload(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)

    with TestClient(app):
        queue = app.state.event_bus.subscribe()
        asyncio.run(app.state.event_bus.publish("mail_received", {"account_id": 7, "count": 1}))
        message = queue.get_nowait()
        app.state.event_bus.unsubscribe(queue)

    assert message.event == "mail_received"
    assert message.data["account_id"] == 7


def test_mail_messages_list_supports_account_and_query_filter(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)

    with TestClient(app) as client:
        headers = {"X-Desktop-Token": "test-token"}
        with SessionLocal() as session:
            first = Account(
                email="mail-filter@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
            )
            second = Account(
                email="other@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
            )
            session.add_all([first, second])
            session.commit()
            session.refresh(first)
            session.refresh(second)
            session.add_all(
                [
                    MailMessage(
                        account_id=first.id,
                        folder="INBOX",
                        uidvalidity="1",
                        uid=1,
                        subject="Read B",
                        sender="b@example.com",
                        recipients="to@example.com",
                        snippet="r",
                    ),
                    MailMessage(
                        account_id=first.id,
                        folder="INBOX",
                        uidvalidity="1",
                        uid=2,
                        subject="Project Update",
                        sender="team@example.com",
                        recipients="reader@example.com",
                        snippet="contains keyword",
                    ),
                    MailMessage(
                        account_id=second.id,
                        folder="INBOX",
                        uidvalidity="1",
                        uid=3,
                        subject="Other Account",
                        sender="other@example.com",
                        recipients="else@example.com",
                        snippet="other",
                    ),
                ]
            )
            session.commit()

        account_messages = client.get(f"/mail/messages?account_id={first.id}", headers=headers).json()
        keyword_messages = client.get("/mail/messages?query=Update", headers=headers).json()

    assert len(account_messages) == 2
    assert {item["subject"] for item in account_messages} == {"Read B", "Project Update"}
    assert len(keyword_messages) == 1
    assert keyword_messages[0]["subject"] == "Project Update"


class FakeAuthService:
    def __init__(self, expires_at: datetime | None = None) -> None:
        self.calls = 0
        self.expires_at = expires_at or (datetime.utcnow() + timedelta(hours=1))

    async def refresh_access_token(self, account: Account) -> AccessTokenBundle:
        self.calls += 1
        return AccessTokenBundle(
            access_token=f"token-for-{account.email}",
            expires_at=self.expires_at,
            refreshed=True,
        )


class FakeImapService:
    def __init__(self) -> None:
        self.calls = 0

    async def test_connection(self, account: Account, access_token: str):
        return type("ConnectionResult", (), {"message": f"IMAP ok for {account.email}"})()

    async def sync_inbox(self, account: Account, mailbox_state: MailboxState | None, access_token: str) -> SyncOutcome:
        self.calls += 1
        if self.calls == 1:
            messages = [
                FetchedMessage(
                    folder="INBOX",
                    uidvalidity="1",
                    uid=10,
                    message_id="msg-10",
                    subject="Welcome",
                    sender="sender@example.com",
                    from_name="Sender",
                    recipients="alpha@outlook.com",
                    snippet="hello",
                    body_text="hello",
                    body_html=None,
                    is_unread=True,
                    received_at=datetime.utcnow(),
                )
            ]
            return SyncOutcome(
                uidvalidity="1",
                last_uid=10,
                idle_supported=False,
                idle_triggered=False,
                idle_cycle_renewed=False,
                messages=messages,
            )

        messages = [
            FetchedMessage(
                folder="INBOX",
                uidvalidity="1",
                uid=10,
                message_id="msg-10",
                subject="Welcome",
                sender="sender@example.com",
                from_name="Sender",
                recipients="alpha@outlook.com",
                snippet="hello again",
                body_text="hello again",
                body_html=None,
                is_unread=False,
                received_at=datetime.utcnow(),
            ),
            FetchedMessage(
                folder="INBOX",
                uidvalidity="1",
                uid=11,
                message_id="msg-11",
                subject="Update",
                sender="sender@example.com",
                from_name="Sender",
                recipients="alpha@outlook.com",
                snippet="second mail",
                body_text="second mail",
                body_html=None,
                is_unread=True,
                received_at=datetime.utcnow(),
            ),
        ]
        return SyncOutcome(
            uidvalidity="1",
            last_uid=11,
            idle_supported=False,
            idle_triggered=False,
            idle_cycle_renewed=False,
            messages=messages,
        )


class BlockingImapService:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    async def test_connection(self, account: Account, access_token: str):
        return type("ConnectionResult", (), {"message": f"IMAP ok for {account.email}"})()

    async def sync_inbox(self, account: Account, mailbox_state: MailboxState | None, access_token: str) -> SyncOutcome:
        self.started.set()
        await self.release.wait()
        return SyncOutcome(
            uidvalidity="1",
            last_uid=0,
            idle_supported=True,
            idle_triggered=False,
            idle_cycle_renewed=True,
            messages=[],
        )


class IdleRenewingImapService:
    def __init__(self) -> None:
        self.calls = 0

    async def test_connection(self, account: Account, access_token: str):
        return type("ConnectionResult", (), {"message": f"IMAP ok for {account.email}"})()

    async def sync_inbox(self, account: Account, mailbox_state: MailboxState | None, access_token: str) -> SyncOutcome:
        self.calls += 1
        return SyncOutcome(
            uidvalidity="1",
            last_uid=mailbox_state.last_uid if mailbox_state else 0,
            idle_supported=True,
            idle_triggered=False,
            idle_cycle_renewed=True,
            messages=[],
        )


class TransientIdleDropImapService:
    async def test_connection(self, account: Account, access_token: str):
        return type("ConnectionResult", (), {"message": f"IMAP ok for {account.email}"})()

    async def sync_inbox(self, account: Account, mailbox_state: MailboxState | None, access_token: str) -> SyncOutcome:
        raise OSError("idle connection closed")


@pytest.mark.asyncio
async def test_sync_service_upserts_messages_and_advances_cursor(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="alpha@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=FakeAuthService(),
                imap_service=FakeImapService(),
                event_bus=EventBus(),
            ),
            enabled=False,
        )

        await sync_service._sync_account(account_id)
        await sync_service._sync_account(account_id)

        with SessionLocal() as session:
            stored_messages = list(session.scalars(select(MailMessage).order_by(MailMessage.uid.asc())))
            mailbox_state = session.scalar(select(MailboxState).where(MailboxState.account_id == account_id))
            account = session.get(Account, account_id)

        assert [message.uid for message in stored_messages] == [10, 11]
        assert mailbox_state is not None
        assert mailbox_state.last_uid == 11
        assert account is not None
        assert account.message_count == 2
        assert account.account_status == "connected"
        assert account.access_token == "token-for-alpha@outlook.com"


@pytest.mark.asyncio
async def test_test_account_reuses_valid_access_token(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="reuse@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
                access_token="cached-token",
                access_token_expires_at=datetime.utcnow() + timedelta(minutes=30),
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

        fake_auth = FakeAuthService()
        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=fake_auth,
                imap_service=FakeImapService(),
                event_bus=EventBus(),
            ),
            enabled=False,
        )

        await sync_service.test_account(account_id)

        with SessionLocal() as session:
            stored = session.get(Account, account_id)

        assert fake_auth.calls == 0
        assert stored is not None
        assert stored.access_token == "cached-token"


@pytest.mark.asyncio
async def test_sync_service_refreshes_token_when_expiry_is_near(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="near-expiry@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
                access_token="stale-token",
                access_token_expires_at=datetime.utcnow() + timedelta(minutes=2),
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

        fake_auth = FakeAuthService(expires_at=datetime.utcnow() + timedelta(hours=1))
        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=fake_auth,
                imap_service=FakeImapService(),
                event_bus=EventBus(),
            ),
            enabled=False,
        )

        await sync_service._sync_account(account_id)

        with SessionLocal() as session:
            stored = session.get(Account, account_id)

        assert fake_auth.calls == 1
        assert stored is not None
        assert stored.access_token == "token-for-near-expiry@outlook.com"


@pytest.mark.asyncio
async def test_polling_sync_reuses_existing_token_between_cycles(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="poll@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
                access_token="cached-token",
                access_token_expires_at=datetime.utcnow() + timedelta(minutes=30),
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

        fake_auth = FakeAuthService()
        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=fake_auth,
                imap_service=FakeImapService(),
                event_bus=EventBus(),
            ),
            enabled=False,
        )

        await sync_service._sync_account(account_id)
        await sync_service._sync_account(account_id)

        with SessionLocal() as session:
            stored = session.get(Account, account_id)
            mailbox_state = session.scalar(select(MailboxState).where(MailboxState.account_id == account_id))

        assert fake_auth.calls == 0
        assert stored is not None
        assert stored.access_token == "cached-token"
        assert mailbox_state is not None
        assert mailbox_state.fallback_mode == "poll"


@pytest.mark.asyncio
async def test_manual_connectivity_test_runs_while_worker_is_active(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="blocked@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
                access_token="cached-token",
                access_token_expires_at=datetime.utcnow() + timedelta(minutes=30),
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

        blocking_imap = BlockingImapService()
        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=FakeAuthService(),
                imap_service=blocking_imap,
                event_bus=EventBus(),
            ),
            enabled=True,
        )

        sync_service.ensure_worker(account_id)
        await asyncio.wait_for(blocking_imap.started.wait(), timeout=1)

        result = await asyncio.wait_for(sync_service.test_account_with_error_handling(account_id), timeout=1)

        assert result.status == "success"
        assert result.message == "IMAP ok for blocked@outlook.com"

        await sync_service.stop()


@pytest.mark.asyncio
async def test_idle_sync_keeps_idle_mode_after_normal_renewal(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="idle@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
                access_token="cached-token",
                access_token_expires_at=datetime.utcnow() + timedelta(minutes=30),
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=FakeAuthService(),
                imap_service=IdleRenewingImapService(),
                event_bus=EventBus(),
            ),
            enabled=False,
        )

        await sync_service._sync_account(account_id)

        with SessionLocal() as session:
            stored = session.get(Account, account_id)
            mailbox_state = session.scalar(select(MailboxState).where(MailboxState.account_id == account_id))

        assert stored is not None
        assert stored.last_error is None
        assert mailbox_state is not None
        assert mailbox_state.fallback_mode == "idle"


@pytest.mark.asyncio
async def test_sync_service_treats_idle_disconnect_as_transient(tmp_path: Path):
    app = create_app(settings=make_settings(tmp_path), enable_sync=False)
    with TestClient(app):
        with SessionLocal() as session:
            account = Account(
                email="idle-drop@outlook.com",
                domain="outlook.com",
                password="pw",
                client_id="client",
                refresh_token="refresh",
                access_token="cached-token",
                access_token_expires_at=datetime.utcnow() + timedelta(minutes=30),
            )
            session.add(account)
            session.commit()
            session.refresh(account)
            account_id = account.id

            mailbox_state = MailboxState(
                account_id=account_id,
                folder="INBOX",
                uidvalidity="1",
                last_uid=7,
                idle_supported=True,
                fallback_mode="idle",
                last_synced_at=datetime.utcnow(),
            )
            session.add(mailbox_state)
            session.commit()

        sync_service = AccountSyncService(
            SyncDependencies(
                settings=make_settings(tmp_path),
                auth_service=FakeAuthService(),
                imap_service=TransientIdleDropImapService(),
                event_bus=EventBus(),
            ),
            enabled=False,
        )

        await sync_service._sync_account(account_id)

        with SessionLocal() as session:
            stored = session.get(Account, account_id)
            mailbox_state = session.scalar(select(MailboxState).where(MailboxState.account_id == account_id))

        assert stored is not None
        assert stored.account_status == "connected"
        assert stored.last_error is None
        assert mailbox_state is not None
        assert mailbox_state.fallback_mode == "idle"


class FakeIdleClient:
    def __init__(self, *args, **kwargs) -> None:
        self._selected = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def oauth2_login(self, email: str, access_token: str) -> None:
        return None

    def select_folder(self, folder: str, readonly: bool = True):
        self._selected = True
        return {"UIDVALIDITY": "1"}

    def search(self, criteria):
        return []

    def fetch(self, uids, data_items):
        return {}

    def capabilities(self):
        return {b"IDLE"}

    def idle(self) -> None:
        return None

    def idle_check(self, timeout: int):
        raise imap_exceptions.IMAPClientAbortError("connection closed")

    def idle_done(self) -> None:
        raise imap_exceptions.IllegalStateError("idle already closed")


def test_imap_service_treats_idle_disconnect_as_normal_renewal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(imap_sync, "IMAPClient", FakeIdleClient)
    service = OutlookImapService(make_settings(tmp_path))

    outcome = service._sync_inbox_sync("alpha@outlook.com", "token", last_uid=0, known_uidvalidity=None)

    assert outcome.idle_supported is True
    assert outcome.idle_cycle_renewed is True
    assert outcome.idle_triggered is False
