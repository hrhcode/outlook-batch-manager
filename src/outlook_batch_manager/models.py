from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class AccountStatus(StrEnum):
    ACTIVE = "active"
    PENDING = "pending"
    LOGIN_FAILED = "login_failed"
    DISABLED = "disabled"


class TokenStatus(StrEnum):
    VALID = "valid"
    EXPIRED = "expired"
    FAILED = "failed"


class TaskType(StrEnum):
    REGISTER = "register"
    LOGIN_CHECK = "login_check"
    TOKEN_REFRESH = "token_refresh"


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProxyStatus(StrEnum):
    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"


@dataclass(slots=True)
class Account:
    email: str
    password: str
    status: AccountStatus = AccountStatus.PENDING
    source: str = "manual"
    group_name: str = "default"
    notes: str = ""
    recovery_email: str = ""
    created_at: datetime | None = None
    last_login_check_at: datetime | None = None
    id: int | None = None


@dataclass(slots=True)
class AccountSummary:
    account: Account
    token_status: str = ""
    token_expires_at: datetime | None = None


@dataclass(slots=True)
class TokenRecord:
    account_id: int
    access_token: str = ""
    refresh_token: str = ""
    expires_at: datetime | None = None
    last_refreshed_at: datetime | None = None
    status: TokenStatus = TokenStatus.FAILED
    id: int | None = None


@dataclass(slots=True)
class ProxyRecord:
    server: str
    enabled: bool = True
    status: ProxyStatus = ProxyStatus.UNKNOWN
    last_used_at: datetime | None = None
    id: int | None = None


@dataclass(slots=True)
class TaskRecord:
    task_type: TaskType
    config_snapshot: dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    success_count: int = 0
    failure_count: int = 0
    started_at: datetime | None = None
    finished_at: datetime | None = None
    latest_error: str = ""
    id: int | None = None


@dataclass(slots=True)
class TaskLogRecord:
    task_id: int
    level: str
    message: str
    account_email: str = ""
    created_at: datetime | None = None
    id: int | None = None


@dataclass(slots=True)
class RegisterTaskConfig:
    batch_size: int = 5
    concurrent_workers: int = 2
    max_retries: int = 1
    fetch_token: bool = True
    proxy_mode: str = "pool"
    headless: bool = False
    notes: str = ""


@dataclass(slots=True)
class TaskProgress:
    task_id: int
    task_type: TaskType
    status: TaskStatus
    success_count: int = 0
    failure_count: int = 0
    latest_message: str = ""
    recent_logs: list[TaskLogRecord] = field(default_factory=list)
