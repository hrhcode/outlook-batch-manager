from pathlib import Path

from outlook_batch_manager.models import Account, AccountStatus
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

