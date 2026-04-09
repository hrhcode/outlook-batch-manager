from pathlib import Path

from outlook_batch_manager.automation.runner import TaskRunner
from outlook_batch_manager.models import RegisterTaskConfig
from outlook_batch_manager.services.account_service import AccountService
from outlook_batch_manager.services.proxy_service import ProxyService
from outlook_batch_manager.services.settings_service import SettingsService
from outlook_batch_manager.storage.database import Database


def test_registration_task_persists_accounts(tmp_path: Path) -> None:
    database = Database(tmp_path / "app.db")
    accounts = AccountService(database)
    proxies = ProxyService(database)
    settings = SettingsService(tmp_path / "settings.json")
    settings.save({"use_mock_driver": True})
    runner = TaskRunner(database, accounts, proxies, settings)

    task_id = runner.run_registration_task(RegisterTaskConfig(batch_size=2, concurrent_workers=1))
    assert task_id > 0
    assert len(accounts.list_accounts()) == 2
