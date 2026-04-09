from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta

from outlook_batch_manager.models import Account


@dataclass(slots=True)
class RegistrationPayload:
    email: str
    password: str
    first_name: str
    last_name: str
    birth_year: int
    birth_month: int
    birth_day: int


@dataclass(slots=True)
class AutomationResult:
    success: bool
    message: str
    account: Account | None = None
    access_token: str = ""
    refresh_token: str = ""
    expires_at: datetime | None = None


class AutomationDriver(ABC):
    @abstractmethod
    def register(self, payload: RegistrationPayload, proxy: str | None = None) -> AutomationResult:
        raise NotImplementedError

    @abstractmethod
    def verify_login(self, email: str, password: str, proxy: str | None = None) -> AutomationResult:
        raise NotImplementedError

    @abstractmethod
    def refresh_token(
        self,
        email: str,
        password: str,
        proxy: str | None = None,
        refresh_token: str = "",
    ) -> AutomationResult:
        raise NotImplementedError


class MockAutomationDriver(AutomationDriver):
    def register(self, payload: RegistrationPayload, proxy: str | None = None) -> AutomationResult:
        account = Account(
            email=payload.email,
            password=payload.password,
            source="register_task",
        )
        return AutomationResult(
            success=True,
            message=f"模拟注册成功: {payload.email}",
            account=account,
            access_token=f"mock-access-{payload.email}",
            refresh_token=f"mock-refresh-{payload.email}",
            expires_at=datetime.now() + timedelta(hours=1),
        )

    def verify_login(self, email: str, password: str, proxy: str | None = None) -> AutomationResult:
        return AutomationResult(success=True, message=f"模拟登录校验成功: {email}")

    def refresh_token(
        self,
        email: str,
        password: str,
        proxy: str | None = None,
        refresh_token: str = "",
    ) -> AutomationResult:
        return AutomationResult(
            success=True,
            message=f"模拟刷新 Token 成功: {email}",
            access_token=f"mock-access-{email}",
            refresh_token=refresh_token or f"mock-refresh-{email}",
            expires_at=datetime.now() + timedelta(hours=1),
        )
