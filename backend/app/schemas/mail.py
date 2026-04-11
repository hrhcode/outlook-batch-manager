from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MailMessageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    subject: str
    sender: str
    recipients: str | None
    snippet: str
    received_at: datetime | None
    synced_at: datetime


class MailMessageDetail(MailMessageSummary):
    body_text: str | None
    body_html: str | None
    recipients: str | None
