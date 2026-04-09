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

                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    status TEXT NOT NULL,
                    source TEXT NOT NULL,
                    group_name TEXT NOT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    recovery_email TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    last_login_check_at TEXT
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
                """
            )

    @staticmethod
    def encode_json(payload: dict) -> str:
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def now_iso() -> str:
        return datetime.now().isoformat(timespec="seconds")

