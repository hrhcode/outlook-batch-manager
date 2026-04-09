from __future__ import annotations

import email
import imaplib
import json
import poplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.message import Message
from pathlib import Path
from typing import Any

import requests

from outlook_batch_manager.models import (
    Account,
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
                accounts.mail_provider AS mail_provider
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
                "mail_provider": row["mail_provider"],
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
            rows = connection.execute(
                "SELECT * FROM mail_sync_runs ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            MailSyncRun(
                id=int(row["id"]),
                account_id=int(row["account_id"]) if row["account_id"] is not None else None,
                source=MailSource(row["source"]),
                status=TaskStatus(row["status"]),
                message_count=int(row["message_count"]),
                latest_error=row["latest_error"],
                started_at=datetime.fromisoformat(row["started_at"]) if row["started_at"] else None,
                finished_at=datetime.fromisoformat(row["finished_at"]) if row["finished_at"] else None,
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
        recent_run = self.list_sync_runs(1)
        return {
            "total_messages": int(row["total_messages"] or 0),
            "unread_messages": int(row["unread_messages"] or 0),
            "latest_run": self._serialize_run(recent_run[0]) if recent_run else None,
        }

    def sync_account(
        self,
        account: Account,
        *,
        source: MailSource = MailSource.AUTO,
        limit: int = 20,
        unread_only: bool = False,
    ) -> MailSyncOutcome:
        started_at = self.database.now_iso()
        run_id = self._create_sync_run(account.id, source, started_at)
        settings = self.settings.load()
        use_mock_driver = bool(settings.get("use_mock_driver", True))
        try:
            if use_mock_driver:
                messages = self._mock_messages(account, limit)
                self._store_messages(account.id or 0, MailSource.MOCK, messages)
                self._finish_sync_run(run_id, TaskStatus.COMPLETED, len(messages), "")
                return MailSyncOutcome(
                    account_id=account.id or 0,
                    account_email=account.email,
                    source=MailSource.MOCK,
                    success=True,
                    message_count=len(messages),
                )

            chosen_source, messages = self._resolve_messages(account, source, limit, unread_only, settings)
            self._store_messages(account.id or 0, chosen_source, messages)
            self._finish_sync_run(run_id, TaskStatus.COMPLETED, len(messages), "")
            return MailSyncOutcome(
                account_id=account.id or 0,
                account_email=account.email,
                source=chosen_source,
                success=True,
                message_count=len(messages),
            )
        except Exception as exc:
            self._finish_sync_run(run_id, TaskStatus.FAILED, 0, str(exc))
            return MailSyncOutcome(
                account_id=account.id or 0,
                account_email=account.email,
                source=source,
                success=False,
                latest_error=str(exc),
            )

    def _resolve_messages(
        self,
        account: Account,
        source: MailSource,
        limit: int,
        unread_only: bool,
        settings: dict[str, Any],
    ) -> tuple[MailSource, list[MessageRecord]]:
        if source == MailSource.GRAPH:
            return MailSource.GRAPH, self._sync_graph(account, limit)
        if source == MailSource.IMAP:
            return MailSource.IMAP, self._sync_imap(account, limit, unread_only, settings)
        if source == MailSource.POP:
            return MailSource.POP, self._sync_pop(account, limit, settings)

        graph_error = None
        try:
            return MailSource.GRAPH, self._sync_graph(account, limit)
        except Exception as exc:
            graph_error = exc

        mail_protocols = settings.get("mail_protocols", {})
        if mail_protocols.get("imap", {}).get("enabled", False):
            try:
                return MailSource.IMAP, self._sync_imap(account, limit, unread_only, settings)
            except Exception:
                pass
        if mail_protocols.get("pop", {}).get("enabled", False):
            return MailSource.POP, self._sync_pop(account, limit, settings)
        if graph_error is not None:
            raise graph_error
        raise RuntimeError("未找到可用的邮件同步方式")

    def _sync_graph(self, account: Account, limit: int) -> list[MessageRecord]:
        token = self.accounts.get_token(account.id or 0)
        if token is None or not token.refresh_token:
            raise RuntimeError(f"{account.email} 缺少可用的 refresh token")

        settings = self.settings.load()
        client_id = account.client_id_override or settings.get("client_id", "")
        redirect_url = settings.get("redirect_url", "")
        scopes = settings.get("scopes") or ["offline_access", "https://graph.microsoft.com/Mail.Read"]
        if not client_id or not redirect_url:
            raise RuntimeError("Graph 同步缺少 client_id 或 redirect_url")

        response = requests.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            data={
                "client_id": client_id,
                "refresh_token": token.refresh_token,
                "grant_type": "refresh_token",
                "redirect_uri": redirect_url,
                "scope": " ".join(scopes),
            },
            timeout=30,
        )
        payload = response.json()
        access_token = payload.get("access_token", "")
        refreshed_token = payload.get("refresh_token", token.refresh_token)
        if not access_token:
            raise RuntimeError(f"Graph token 刷新失败: {payload}")

        self.accounts.save_token(
            TokenRecord(
                account_id=account.id or 0,
                access_token=access_token,
                refresh_token=refreshed_token,
                expires_at=datetime.now() + timedelta(seconds=int(payload.get("expires_in", 3600))),
                last_refreshed_at=datetime.now(),
                status=TokenStatus.VALID,
            )
        )

        mail_response = requests.get(
            "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages",
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "$top": limit,
                "$orderby": "receivedDateTime DESC",
                "$select": "id,internetMessageId,subject,receivedDateTime,isRead,bodyPreview,from,toRecipients,hasAttachments",
            },
            timeout=30,
        )
        mail_payload = mail_response.json()
        values = mail_payload.get("value")
        if not isinstance(values, list):
            raise RuntimeError(f"Graph 邮件读取失败: {mail_payload}")

        messages: list[MessageRecord] = []
        for item in values:
            to_list = item.get("toRecipients", [])
            to_address = "; ".join(
                recipient.get("emailAddress", {}).get("address", "")
                for recipient in to_list
                if recipient.get("emailAddress", {}).get("address")
            )
            messages.append(
                MessageRecord(
                    account_id=account.id or 0,
                    source=MailSource.GRAPH,
                    message_id=item.get("id", ""),
                    internet_message_id=item.get("internetMessageId", "") or "",
                    folder_name="Inbox",
                    subject=item.get("subject", "") or "(无主题)",
                    from_address=item.get("from", {}).get("emailAddress", {}).get("address", ""),
                    to_address=to_address,
                    received_at=self._parse_iso_datetime(item.get("receivedDateTime")),
                    is_read=bool(item.get("isRead", False)),
                    has_attachments=bool(item.get("hasAttachments", False)),
                    snippet=item.get("bodyPreview", "") or "",
                    raw_payload=json.dumps(item, ensure_ascii=False),
                    synced_at=datetime.now(),
                )
            )
        return messages

    def _sync_imap(
        self,
        account: Account,
        limit: int,
        unread_only: bool,
        settings: dict[str, Any],
    ) -> list[MessageRecord]:
        config = settings.get("mail_protocols", {}).get("imap", {})
        if not config.get("enabled", False):
            raise RuntimeError("IMAP 未启用")
        host = config.get("host", "outlook.office365.com")
        port = int(config.get("port", 993))
        use_ssl = bool(config.get("use_ssl", True))
        client = imaplib.IMAP4_SSL(host, port) if use_ssl else imaplib.IMAP4(host, port)
        try:
            client.login(account.email, account.password)
            client.select("INBOX", readonly=True)
            criteria = "UNSEEN" if unread_only else "ALL"
            status, data = client.search(None, criteria)
            if status != "OK":
                raise RuntimeError("IMAP 搜索失败")
            identifiers = data[0].split()[-limit:]
            messages: list[MessageRecord] = []
            for identifier in reversed(identifiers):
                fetch_status, payload = client.fetch(identifier, "(RFC822)")
                if fetch_status != "OK" or not payload or not payload[0]:
                    continue
                parsed = email.message_from_bytes(payload[0][1])
                messages.append(self._message_from_email(account, MailSource.IMAP, identifier.decode(), parsed))
            return messages
        finally:
            try:
                client.logout()
            except Exception:
                pass

    def _sync_pop(self, account: Account, limit: int, settings: dict[str, Any]) -> list[MessageRecord]:
        config = settings.get("mail_protocols", {}).get("pop", {})
        if not config.get("enabled", False):
            raise RuntimeError("POP 未启用")
        host = config.get("host", "outlook.office365.com")
        port = int(config.get("port", 995))
        use_ssl = bool(config.get("use_ssl", True))
        client = poplib.POP3_SSL(host, port) if use_ssl else poplib.POP3(host, port)
        try:
            client.user(account.email)
            client.pass_(account.password)
            count, _ = client.stat()
            start_index = max(1, count - limit + 1)
            messages: list[MessageRecord] = []
            for index in range(count, start_index - 1, -1):
                _, lines, _ = client.retr(index)
                parsed = email.message_from_bytes(b"\n".join(lines))
                messages.append(self._message_from_email(account, MailSource.POP, str(index), parsed))
            return messages
        finally:
            try:
                client.quit()
            except Exception:
                pass

    def _message_from_email(
        self,
        account: Account,
        source: MailSource,
        message_id: str,
        parsed: Message,
    ) -> MessageRecord:
        return MessageRecord(
            account_id=account.id or 0,
            source=source,
            message_id=message_id,
            internet_message_id=self._decode_mime_value(parsed.get("Message-ID", "")),
            folder_name="Inbox",
            subject=self._decode_mime_value(parsed.get("Subject", "")) or "(无主题)",
            from_address=self._decode_mime_value(parsed.get("From", "")),
            to_address=self._decode_mime_value(parsed.get("To", "")),
            received_at=self._parse_email_date(parsed.get("Date")),
            is_read=False if source == MailSource.POP else "\\Seen" in str(parsed.get("Flags", "")),
            has_attachments=self._has_attachments(parsed),
            snippet=self._extract_snippet(parsed),
            raw_payload=parsed.as_string(),
            synced_at=datetime.now(),
        )

    def _mock_messages(self, account: Account, limit: int) -> list[MessageRecord]:
        now = datetime.now()
        messages: list[MessageRecord] = []
        for index in range(limit):
            messages.append(
                MessageRecord(
                    account_id=account.id or 0,
                    source=MailSource.MOCK,
                    message_id=f"mock-{account.id}-{index}",
                    internet_message_id=f"<mock-{account.id}-{index}@example.com>",
                    folder_name="Inbox",
                    subject=f"示例邮件 {index + 1}",
                    from_address="system@example.com",
                    to_address=account.email,
                    received_at=now - timedelta(minutes=index * 5),
                    is_read=index % 2 == 0,
                    has_attachments=index % 3 == 0,
                    snippet="这是用于界面联调的模拟邮件内容。",
                    raw_payload=json.dumps({"mock": True, "index": index}, ensure_ascii=False),
                    synced_at=now,
                )
            )
        return messages

    def _store_messages(self, account_id: int, source: MailSource, messages: list[MessageRecord]) -> None:
        with self.database.connect() as connection:
            for message in messages:
                received_at = message.received_at.isoformat(timespec="seconds") if message.received_at else None
                synced_at = message.synced_at.isoformat(timespec="seconds") if message.synced_at else self.database.now_iso()
                connection.execute(
                    """
                    INSERT INTO messages (
                        account_id, source, message_id, internet_message_id, folder_name, subject,
                        from_address, to_address, received_at, is_read, has_attachments,
                        snippet, raw_payload, synced_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        account_id,
                        source,
                        message.message_id,
                        message.internet_message_id,
                        message.folder_name,
                        message.subject,
                        message.from_address,
                        message.to_address,
                        received_at,
                        1 if message.is_read else 0,
                        1 if message.has_attachments else 0,
                        message.snippet,
                        message.raw_payload,
                        synced_at,
                    ),
                )

    def _create_sync_run(self, account_id: int | None, source: MailSource, started_at: str) -> int:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO mail_sync_runs (account_id, source, status, message_count, latest_error, started_at, finished_at)
                VALUES (?, ?, ?, 0, '', ?, NULL)
                """,
                (account_id, source, TaskStatus.RUNNING, started_at),
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

    def _parse_iso_datetime(self, value: str | None) -> datetime | None:
        if not value:
            return None
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).astimezone().replace(tzinfo=None)

    def _parse_email_date(self, value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = email.utils.parsedate_to_datetime(value)
        except Exception:
            return None
        if parsed.tzinfo is None:
            return parsed
        return parsed.astimezone(timezone.utc).astimezone().replace(tzinfo=None)

    def _decode_mime_value(self, value: str) -> str:
        if not value:
            return ""
        try:
            return str(make_header(decode_header(value)))
        except Exception:
            return value

    def _extract_snippet(self, parsed: Message) -> str:
        if parsed.is_multipart():
            for part in parsed.walk():
                content_type = part.get_content_type()
                disposition = str(part.get("Content-Disposition", ""))
                if content_type == "text/plain" and "attachment" not in disposition.lower():
                    payload = part.get_payload(decode=True) or b""
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="ignore").strip()[:240]
            return ""
        payload = parsed.get_payload(decode=True) or b""
        charset = parsed.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="ignore").strip()[:240]

    def _has_attachments(self, parsed: Message) -> bool:
        return any(part.get_filename() for part in parsed.walk())

    def _serialize_run(self, run: MailSyncRun) -> dict[str, Any]:
        return {
            "id": run.id,
            "account_id": run.account_id,
            "source": run.source,
            "status": run.status,
            "message_count": run.message_count,
            "latest_error": run.latest_error,
            "started_at": run.started_at.isoformat(timespec="seconds") if run.started_at else None,
            "finished_at": run.finished_at.isoformat(timespec="seconds") if run.finished_at else None,
        }
