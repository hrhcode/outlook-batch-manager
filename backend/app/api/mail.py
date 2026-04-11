from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from backend.app.api.deps import assert_desktop_auth, get_db_session
from backend.app.db.models import MailMessage
from backend.app.schemas.mail import (
    MailMessageDetail,
    MailMessageSummary,
)

router = APIRouter(prefix="/mail", tags=["mail"], dependencies=[Depends(assert_desktop_auth)])


@router.get("/messages", response_model=list[MailMessageSummary])
def list_messages(
    account_id: int | None = None,
    query: str | None = None,
    session: Session = Depends(get_db_session)
) -> list[MailMessage]:
    statement = select(MailMessage).order_by(MailMessage.received_at.desc().nullslast(), MailMessage.synced_at.desc())
    conditions = []
    if account_id:
        conditions.append(MailMessage.account_id == account_id)
    if query:
        pattern = f"%{query}%"
        conditions.append(
            or_(
                MailMessage.subject.ilike(pattern),
                MailMessage.sender.ilike(pattern),
                MailMessage.recipients.ilike(pattern),
                MailMessage.snippet.ilike(pattern)
            )
        )
    if conditions:
        statement = statement.where(and_(*conditions))
    statement = statement.limit(200)
    return list(session.scalars(statement))


@router.get("/messages/{message_id}", response_model=MailMessageDetail)
def get_message(message_id: int, session: Session = Depends(get_db_session)) -> MailMessage:
    message = session.get(MailMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found.")
    return message
