from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from backend.app.api.deps import assert_desktop_auth, get_db_session, get_sync_service
from backend.app.db.models import Account, MailMessage
from backend.app.schemas.accounts import (
    AccountCreate,
    AccountDetail,
    AccountImportResponse,
    AccountSummary,
    AccountTestResult,
    MailPreview,
    TestRequest,
)
from backend.app.services.import_export import decode_import_bytes, export_account_rows, parse_import_blob
from backend.app.services.secret_store import PlaintextSecretStore

router = APIRouter(prefix="/accounts", tags=["accounts"], dependencies=[Depends(assert_desktop_auth)])
secret_store = PlaintextSecretStore()


def _domain_from_email(email: str) -> str:
    return email.split("@", maxsplit=1)[-1].lower()


def _apply_filters(statement, query: str | None, account_status: str | None):
    if query:
        pattern = f"%{query.lower()}%"
        statement = statement.where(
            or_(
                Account.email.ilike(pattern),
                Account.client_id.ilike(pattern)
            )
        )
    if account_status:
        statement = statement.where(Account.account_status == account_status)
    return statement


def _resolve_sync_mode(account: Account) -> str | None:
    mailbox_state = account.mailbox_state
    if mailbox_state is None or mailbox_state.last_synced_at is None:
        return None
    if mailbox_state.fallback_mode == "idle":
        return "idle"
    if mailbox_state.fallback_mode == "poll":
        return "poll"
    return None


def _build_account_summary(account: Account) -> AccountSummary:
    mailbox_state = account.mailbox_state
    return AccountSummary(
        id=account.id,
        email=account.email,
        password=secret_store.reveal(account.password),
        client_id=secret_store.reveal(account.client_id),
        refresh_token=secret_store.reveal(account.refresh_token),
        access_token=account.access_token,
        access_token_expires_at=account.access_token_expires_at,
        sync_mode=_resolve_sync_mode(account),
        last_synced_at=mailbox_state.last_synced_at if mailbox_state else None,
        account_status=account.account_status,
        last_test_status=account.last_test_status,
        last_error=account.last_error,
        message_count=account.message_count,
        updated_at=account.updated_at
    )


@router.get("", response_model=list[AccountSummary])
def list_accounts(
    query: str | None = None,
    account_status: str | None = Query(None),
    session: Session = Depends(get_db_session)
) -> list[AccountSummary]:
    statement = select(Account).options(selectinload(Account.mailbox_state)).order_by(Account.updated_at.desc())
    statement = _apply_filters(statement, query, account_status)
    return [_build_account_summary(account) for account in session.scalars(statement)]


@router.post("", response_model=AccountSummary)
def create_account(payload: AccountCreate, session: Session = Depends(get_db_session), sync_service=Depends(get_sync_service)) -> Account:
    email = payload.email.lower().strip()
    account = session.scalar(select(Account).where(Account.email == email))
    if account:
        account.password = secret_store.store(payload.password)
        account.client_id = secret_store.store(payload.client_id)
        account.refresh_token = secret_store.store(payload.refresh_token)
        account.access_token = None
        account.access_token_expires_at = None
        account.account_status = "disconnected"
        account.last_error = None
        account.updated_at = datetime.utcnow()
    else:
        account = Account(
            email=email,
            domain=_domain_from_email(email),
            password=secret_store.store(payload.password),
            client_id=secret_store.store(payload.client_id),
            refresh_token=secret_store.store(payload.refresh_token),
            account_status="disconnected"
        )
        session.add(account)

    session.commit()
    session.refresh(account)
    sync_service.ensure_worker(account.id)
    return _build_account_summary(account)


@router.post("/import-file", response_model=AccountImportResponse)
async def import_accounts_file(
    file: UploadFile = File(...),
    session: Session = Depends(get_db_session),
    sync_service=Depends(get_sync_service)
) -> AccountImportResponse:
    content = decode_import_bytes(await file.read())
    parsed, failures = parse_import_blob(content)
    return _persist_import_rows(parsed, failures, session, sync_service)


def _persist_import_rows(parsed, failures, session: Session, sync_service) -> AccountImportResponse:
    imported = 0
    updated = 0

    for row in parsed:
        account = session.scalar(select(Account).where(Account.email == row.email))
        if account:
            account.password = secret_store.store(row.password)
            account.client_id = secret_store.store(row.client_id)
            account.refresh_token = secret_store.store(row.refresh_token)
            account.access_token = None
            account.access_token_expires_at = None
            account.account_status = "disconnected"
            account.last_error = None
            account.updated_at = datetime.utcnow()
            updated += 1
        else:
            account = Account(
                email=row.email,
                domain=_domain_from_email(row.email),
                password=secret_store.store(row.password),
                client_id=secret_store.store(row.client_id),
                refresh_token=secret_store.store(row.refresh_token),
                account_status="disconnected"
            )
            session.add(account)
            session.flush()
            imported += 1

        sync_service.ensure_worker(account.id)

    session.commit()
    return AccountImportResponse(imported=imported, updated=updated, failures=failures)


@router.get("/export")
def export_accounts(
    ids: list[int] = Query(default=[]),
    query: str | None = None,
    account_status: str | None = None,
    session: Session = Depends(get_db_session)
) -> Response:
    statement = select(Account).order_by(Account.email.asc())
    if ids:
        statement = statement.where(Account.id.in_(ids))
    else:
        statement = _apply_filters(statement, query, account_status)

    accounts = list(session.scalars(statement))
    content = export_account_rows(
        [
            (
                account.email,
                secret_store.reveal(account.password),
                secret_store.reveal(account.client_id),
                secret_store.reveal(account.refresh_token),
            )
            for account in accounts
        ]
    )
    return Response(content=content, media_type="text/plain; charset=utf-8")


@router.post("/test", response_model=AccountTestResult)
async def test_account(payload: TestRequest, sync_service=Depends(get_sync_service)) -> AccountTestResult:
    return await sync_service.test_account_with_error_handling(payload.id)


@router.get("/{account_id}", response_model=AccountDetail)
def get_account(account_id: int, session: Session = Depends(get_db_session)) -> AccountDetail:
    account = session.scalar(select(Account).options(selectinload(Account.mailbox_state)).where(Account.id == account_id))
    if not account:
        raise HTTPException(status_code=404, detail="Account not found.")

    messages = list(
        session.scalars(
            select(MailMessage)
            .where(MailMessage.account_id == account_id)
            .order_by(MailMessage.received_at.desc().nullslast(), MailMessage.synced_at.desc())
            .limit(5)
        )
    )

    return AccountDetail(
        **_build_account_summary(account).model_dump(),
        recent_messages=[
            MailPreview(
                id=item.id,
                subject=item.subject,
                sender=item.sender,
                snippet=item.snippet,
                received_at=item.received_at
            )
            for item in messages
        ]
    )
