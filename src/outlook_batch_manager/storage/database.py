from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Iterator


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            connection = sqlite3.connect(self.path)
            connection.row_factory = sqlite3.Row
            try:
                yield connection
                connection.commit()
            finally:
                connection.close()

    def _initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                PRAGMA journal_mode=WAL;

                DROP INDEX IF EXISTS idx_connection_messages_received;
                DROP INDEX IF EXISTS idx_connection_sync_runs_started;
                DROP INDEX IF EXISTS idx_mail_events_connection_created;
                DROP INDEX IF EXISTS idx_retry_queue_status_available;

                DROP TABLE IF EXISTS mail_connections;
                DROP TABLE IF EXISTS connection_tokens;
                DROP TABLE IF EXISTS oauth_sessions;
                DROP TABLE IF EXISTS connection_diagnostics;
                DROP TABLE IF EXISTS connection_mail_sync_runs;
                DROP TABLE IF EXISTS connection_messages;
                DROP TABLE IF EXISTS mail_events;
                DROP TABLE IF EXISTS retry_queue;
                DROP TABLE IF EXISTS outbound_messages;
                DROP TABLE IF EXISTS legacy_accounts_backup;
                DROP TABLE IF EXISTS legacy_tokens_backup;
                DROP TABLE IF EXISTS legacy_messages_backup;

                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    status TEXT NOT NULL,
                    source TEXT NOT NULL,
                    group_name TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    recovery_email TEXT NOT NULL DEFAULT '',
                    mail_provider TEXT NOT NULL DEFAULT 'outlook',
                    client_id_override TEXT NOT NULL DEFAULT '',
                    import_format TEXT NOT NULL DEFAULT 'manual',
                    connectivity_status TEXT NOT NULL DEFAULT 'unknown',
                    mail_capability_status TEXT NOT NULL DEFAULT 'not_ready',
                    created_at TEXT NOT NULL,
                    last_login_check_at TEXT,
                    last_mail_sync_at TEXT,
                    last_error TEXT NOT NULL DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER NOT NULL,
                    access_token TEXT NOT NULL DEFAULT '',
                    refresh_token TEXT NOT NULL DEFAULT '',
                    expires_at TEXT,
                    last_refreshed_at TEXT,
                    status TEXT NOT NULL,
                    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS proxies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server TEXT NOT NULL UNIQUE,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    status TEXT NOT NULL,
                    last_used_at TEXT
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_type TEXT NOT NULL,
                    config_snapshot TEXT NOT NULL,
                    status TEXT NOT NULL,
                    success_count INTEGER NOT NULL DEFAULT 0,
                    failure_count INTEGER NOT NULL DEFAULT 0,
                    started_at TEXT,
                    finished_at TEXT,
                    latest_error TEXT NOT NULL DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS task_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    account_email TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    message_id TEXT NOT NULL,
                    internet_message_id TEXT NOT NULL DEFAULT '',
                    folder_name TEXT NOT NULL DEFAULT 'Inbox',
                    subject TEXT NOT NULL DEFAULT '',
                    from_address TEXT NOT NULL DEFAULT '',
                    to_address TEXT NOT NULL DEFAULT '',
                    received_at TEXT,
                    is_read INTEGER NOT NULL DEFAULT 0,
                    has_attachments INTEGER NOT NULL DEFAULT 0,
                    snippet TEXT NOT NULL DEFAULT '',
                    raw_payload TEXT NOT NULL DEFAULT '',
                    synced_at TEXT NOT NULL,
                    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                    UNIQUE(account_id, source, message_id)
                );

                CREATE TABLE IF NOT EXISTS mail_sync_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    account_id INTEGER,
                    source TEXT NOT NULL,
                    status TEXT NOT NULL,
                    message_count INTEGER NOT NULL DEFAULT 0,
                    latest_error TEXT NOT NULL DEFAULT '',
                    started_at TEXT NOT NULL,
                    finished_at TEXT,
                    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_account_received
                    ON messages(account_id, received_at DESC);
                CREATE INDEX IF NOT EXISTS idx_mail_sync_runs_started
                    ON mail_sync_runs(started_at DESC);
                """
            )
            self._ensure_column(connection, "accounts", "mail_provider", "TEXT NOT NULL DEFAULT 'outlook'")
            self._ensure_column(connection, "accounts", "client_id_override", "TEXT NOT NULL DEFAULT ''")
            self._ensure_column(connection, "accounts", "import_format", "TEXT NOT NULL DEFAULT 'manual'")
            self._ensure_column(connection, "accounts", "connectivity_status", "TEXT NOT NULL DEFAULT 'unknown'")
            self._ensure_column(connection, "accounts", "mail_capability_status", "TEXT NOT NULL DEFAULT 'not_ready'")
            self._ensure_column(connection, "accounts", "last_mail_sync_at", "TEXT")
            self._ensure_column(connection, "accounts", "last_error", "TEXT NOT NULL DEFAULT ''")

    def _ensure_column(self, connection: sqlite3.Connection, table_name: str, column_name: str, spec: str) -> None:
        existing = {row["name"] for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()}
        if column_name in existing:
            return
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {spec}")

    @staticmethod
    def encode_json(payload: dict) -> str:
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def now_iso() -> str:
        return datetime.now().isoformat(timespec="seconds")
