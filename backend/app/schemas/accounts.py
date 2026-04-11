from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AccountCreate(BaseModel):
    email: str
    password: str
    client_id: str
    refresh_token: str


class ImportFailure(BaseModel):
    line_number: int
    raw: str
    reason: str


class AccountImportResponse(BaseModel):
    imported: int
    updated: int
    failures: list[ImportFailure]


class AccountSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    password: str
    client_id: str
    refresh_token: str
    access_token: str | None
    access_token_expires_at: datetime | None
    sync_mode: str | None
    last_synced_at: datetime | None
    account_status: str
    last_test_status: str
    last_error: str | None
    message_count: int
    updated_at: datetime


class MailPreview(BaseModel):
    id: int
    subject: str
    sender: str
    snippet: str
    received_at: datetime | None


class AccountDetail(AccountSummary):
    recent_messages: list[MailPreview]


class TestRequest(BaseModel):
    id: int


class AccountTestResult(BaseModel):
    id: int
    status: str
    message: str
    tested_at: datetime
