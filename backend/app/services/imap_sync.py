from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime
from email import message_from_bytes
from email.message import Message
from email.policy import default
from html import unescape
import re
from typing import Any

from imapclient import IMAPClient
from imapclient import exceptions as imap_exceptions

from backend.app.core.config import Settings
from backend.app.db.models import Account, MailboxState


class SyncError(RuntimeError):
    pass


@dataclass(slots=True)
class FetchedMessage:
    folder: str
    uidvalidity: str
    uid: int
    message_id: str | None
    subject: str
    sender: str
    from_name: str | None
    recipients: str | None
    snippet: str
    body_text: str | None
    body_html: str | None
    is_unread: bool
    received_at: datetime | None


@dataclass(slots=True)
class SyncOutcome:
    uidvalidity: str
    last_uid: int
    idle_supported: bool
    idle_triggered: bool
    idle_cycle_renewed: bool
    messages: list[FetchedMessage]


@dataclass(slots=True)
class ConnectionTestResult:
    uidvalidity: str
    message: str


def _pick(mapping: dict[Any, Any], key: str, default_value: Any = None) -> Any:
    return mapping.get(key, mapping.get(key.encode("ascii"), default_value))


def _header(message: Message, name: str) -> str:
    value = message.get(name, "")
    return str(value).strip()


def _strip_html(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def _decode_message(raw_message: bytes, uidvalidity: str, uid: int, flags: tuple[Any, ...], received_at: datetime | None) -> FetchedMessage:
    message = message_from_bytes(raw_message, policy=default)
    sender = _header(message, "From")
    recipients = _header(message, "To") or None

    body_text: str | None = None
    body_html: str | None = None

    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            disposition = part.get_content_disposition()
            if disposition == "attachment":
                continue
            if content_type == "text/plain" and body_text is None:
                body_text = part.get_content()
            if content_type == "text/html" and body_html is None:
                body_html = part.get_content()
    else:
        content_type = message.get_content_type()
        if content_type == "text/html":
            body_html = message.get_content()
        else:
            body_text = message.get_content()

    snippet_source = body_text or _strip_html(body_html or "")
    snippet = snippet_source.strip().replace("\n", " ")[:200]

    return FetchedMessage(
        folder="INBOX",
        uidvalidity=uidvalidity,
        uid=uid,
        message_id=_header(message, "Message-ID") or None,
        subject=_header(message, "Subject"),
        sender=sender,
        from_name=message.get("From"),
        recipients=recipients,
        snippet=snippet,
        body_text=body_text,
        body_html=body_html,
        is_unread="\\Seen" not in flags,
        received_at=received_at
    )


class OutlookImapService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def test_connection(self, account: Account, access_token: str) -> ConnectionTestResult:
        return await asyncio.to_thread(self._test_connection_sync, account.email, access_token)

    async def sync_inbox(self, account: Account, mailbox_state: MailboxState | None, access_token: str) -> SyncOutcome:
        last_uid = mailbox_state.last_uid if mailbox_state else 0
        uidvalidity = mailbox_state.uidvalidity if mailbox_state else None
        return await asyncio.to_thread(self._sync_inbox_sync, account.email, access_token, last_uid, uidvalidity)

    def _test_connection_sync(self, email: str, access_token: str) -> ConnectionTestResult:
        with IMAPClient(self.settings.imap_host, self.settings.imap_port, ssl=True, timeout=30.0) as client:
            client.oauth2_login(email, access_token)
            mailbox = client.select_folder("INBOX", readonly=True)
            current_uidvalidity = str(_pick(mailbox, "UIDVALIDITY", "0"))
            return ConnectionTestResult(uidvalidity=current_uidvalidity, message="IMAP 登录成功。")

    def _sync_inbox_sync(self, email: str, access_token: str, last_uid: int, known_uidvalidity: str | None) -> SyncOutcome:
        with IMAPClient(self.settings.imap_host, self.settings.imap_port, ssl=True, timeout=30.0) as client:
            client.oauth2_login(email, access_token)
            mailbox = client.select_folder("INBOX", readonly=True)
            current_uidvalidity = str(_pick(mailbox, "UIDVALIDITY", "0"))

            if known_uidvalidity and known_uidvalidity != current_uidvalidity:
                last_uid = 0

            if last_uid > 0:
                uids = client.search(["UID", f"{last_uid + 1}:*"])
            else:
                all_uids = client.search(["ALL"])
                uids = all_uids[-self.settings.initial_fetch_limit :]

            messages = self._fetch_messages(client, uids, current_uidvalidity)
            latest_uid = max([last_uid, *uids], default=last_uid)

            idle_supported = b"IDLE" in client.capabilities()
            idle_triggered = False
            idle_cycle_renewed = False
            if idle_supported:
                idle_cycle_renewed, idle_triggered = self._run_idle_cycle(client)

                if idle_triggered:
                    new_uids = client.search(["UID", f"{latest_uid + 1}:*"])
                    new_messages = self._fetch_messages(client, new_uids, current_uidvalidity)
                    messages.extend(new_messages)
                    latest_uid = max([latest_uid, *new_uids], default=latest_uid)

            return SyncOutcome(
                uidvalidity=current_uidvalidity,
                last_uid=latest_uid,
                idle_supported=idle_supported,
                idle_triggered=idle_triggered,
                idle_cycle_renewed=idle_cycle_renewed,
                messages=messages
            )

    def _run_idle_cycle(self, client: IMAPClient) -> tuple[bool, bool]:
        client.idle()
        try:
            responses = client.idle_check(timeout=self.settings.idle_timeout_seconds)
            return True, bool(responses)
        except (imap_exceptions.IMAPClientAbortError, imap_exceptions.IllegalStateError, TimeoutError, OSError):
            # Outlook can end an IDLE wait by resetting the connection after the safe window.
            # Treat that as a normal renewal signal so the worker reconnects without falling back.
            return True, False
        finally:
            try:
                client.idle_done()
            except (imap_exceptions.IMAPClientAbortError, imap_exceptions.IllegalStateError, OSError):
                pass

    def _fetch_messages(self, client: IMAPClient, uids: list[int], uidvalidity: str) -> list[FetchedMessage]:
        if not uids:
            return []

        response = client.fetch(uids, ["RFC822", "FLAGS", "INTERNALDATE"])
        fetched: list[FetchedMessage] = []

        for uid in uids:
            payload = response.get(uid)
            if not payload:
                continue

            raw_message = _pick(payload, "RFC822")
            if raw_message is None:
                raise SyncError("IMAP server did not return message payload bytes.")

            flags = tuple(_pick(payload, "FLAGS", ()))
            received_at = _pick(payload, "INTERNALDATE")
            fetched.append(_decode_message(raw_message, uidvalidity, uid, flags, received_at))

        return fetched
