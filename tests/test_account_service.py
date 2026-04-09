from pathlib import Path

from datetime import datetime, timedelta

from outlook_batch_manager.models import Account, AccountStatus, TokenRecord, TokenStatus
from outlook_batch_manager.services.account_service import AccountService
from outlook_batch_manager.storage.database import Database


def test_upsert_and_list_accounts(tmp_path: Path) -> None:
    service = AccountService(Database(tmp_path / "app.db"))
    service.upsert_account(Account(email="a@example.com", password="Password123!", status=AccountStatus.ACTIVE))
    accounts = service.list_accounts()
    assert len(accounts) == 1
    assert accounts[0].email == "a@example.com"


def test_export_and_import_accounts(tmp_path: Path) -> None:
    database = Database(tmp_path / "app.db")
    service = AccountService(database)
    service.upsert_account(Account(email="a@example.com", password="Password123!", status=AccountStatus.ACTIVE))
    destination = tmp_path / "accounts.xlsx"
    service.export_accounts(destination, service.list_accounts())

    imported_service = AccountService(Database(tmp_path / "imported.db"))
    imported_count = imported_service.import_accounts(destination)
    assert imported_count == 1
    assert imported_service.list_accounts()[0].email == "a@example.com"


def test_account_summary_contains_token_info(tmp_path: Path) -> None:
    service = AccountService(Database(tmp_path / "app.db"))
    account = service.upsert_account(Account(email="a@example.com", password="Password123!", status=AccountStatus.ACTIVE))
    service.save_token(
        TokenRecord(
            account_id=account.id or 0,
            access_token="access",
            refresh_token="refresh",
            expires_at=datetime.now() + timedelta(hours=1),
            status=TokenStatus.VALID,
        )
    )
    summary = service.list_account_summaries()[0]
    assert summary.token_status == TokenStatus.VALID


def test_import_text_formats_store_refresh_token_and_provider(tmp_path: Path) -> None:
    source = tmp_path / "accounts.txt"
    source.write_text(
        "\n".join(
            [
                "alpha@outlook.com----Password123!",
                "beta@hotmail.com----Password456!----client-123----refresh-456",
            ]
        ),
        encoding="utf-8",
    )
    service = AccountService(Database(tmp_path / "app.db"))

    imported = service.import_accounts(source)

    assert imported == 2
    summaries = service.list_account_summaries()
    assert summaries[0].account.mail_provider == "hotmail"
    token = service.get_token(summaries[0].account.id or 0)
    assert token is not None
    assert token.refresh_token == "refresh-456"
    assert token.status == TokenStatus.STORED


def test_delete_accounts_removes_account_and_token(tmp_path: Path) -> None:
    service = AccountService(Database(tmp_path / "app.db"))
    account = service.create_account(
        email="delete@example.com",
        password="Password123!",
        client_id_override="client-1",
        refresh_token="refresh-1",
    )

    deleted = service.delete_accounts([account.id or 0])

    assert deleted == 1
    assert service.get_account(account.id or 0) is None
    assert service.get_token(account.id or 0) is None
