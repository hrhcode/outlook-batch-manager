from __future__ import annotations

from datetime import datetime

from outlook_batch_manager.models import ProxyRecord, ProxyStatus
from outlook_batch_manager.storage.database import Database


class ProxyService:
    def __init__(self, database: Database) -> None:
        self.database = database
        self._cursor = 0

    def list_proxies(self) -> list[ProxyRecord]:
        with self.database.connect() as connection:
            rows = connection.execute("SELECT * FROM proxies ORDER BY id ASC").fetchall()
        return [
            ProxyRecord(
                id=int(row["id"]),
                server=row["server"],
                enabled=bool(row["enabled"]),
                status=ProxyStatus(row["status"]),
                last_used_at=datetime.fromisoformat(row["last_used_at"]) if row["last_used_at"] else None,
            )
            for row in rows
        ]

    def import_lines(self, lines: list[str]) -> int:
        cleaned = [line.strip() for line in lines if line.strip()]
        imported = 0
        with self.database.connect() as connection:
            for server in cleaned:
                existing = connection.execute("SELECT id FROM proxies WHERE server = ?", (server,)).fetchone()
                if existing:
                    continue
                connection.execute(
                    "INSERT INTO proxies (server, enabled, status, last_used_at) VALUES (?, ?, ?, ?)",
                    (server, 1, ProxyStatus.UNKNOWN, None),
                )
                imported += 1
        return imported

    def next_proxy(self) -> ProxyRecord | None:
        proxies = [proxy for proxy in self.list_proxies() if proxy.enabled]
        if not proxies:
            return None
        proxy = proxies[self._cursor % len(proxies)]
        self._cursor += 1
        self.mark_used(proxy.id)
        return proxy

    def mark_used(self, proxy_id: int | None) -> None:
        if proxy_id is None:
            return
        with self.database.connect() as connection:
            connection.execute(
                "UPDATE proxies SET last_used_at = ? WHERE id = ?",
                (self.database.now_iso(), proxy_id),
            )

    def update_status(self, proxy_id: int | None, status: ProxyStatus) -> None:
        if proxy_id is None:
            return
        with self.database.connect() as connection:
            connection.execute(
                "UPDATE proxies SET status = ? WHERE id = ?",
                (status, proxy_id),
            )

