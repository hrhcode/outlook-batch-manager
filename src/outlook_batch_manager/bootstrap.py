from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from outlook_batch_manager.services.account_service import AccountService
from outlook_batch_manager.services.mail_service import MailService
from outlook_batch_manager.services.proxy_service import ProxyService
from outlook_batch_manager.services.settings_service import SettingsService
from outlook_batch_manager.services.task_service import TaskService
from outlook_batch_manager.storage.database import Database


@dataclass(slots=True)
class ServiceContainer:
    settings: SettingsService
    accounts: AccountService
    mail: MailService
    proxies: ProxyService
    tasks: TaskService


def bootstrap_services(project_root: Path) -> ServiceContainer:
    app_dir = project_root / "data"
    app_dir.mkdir(parents=True, exist_ok=True)
    database = Database(app_dir / "app.db")
    settings = SettingsService(app_dir / "settings.json")
    accounts = AccountService(database)
    mail = MailService(database, accounts, settings)
    proxies = ProxyService(database)
    tasks = TaskService(database, accounts, mail, proxies, settings)
    return ServiceContainer(
        settings=settings,
        accounts=accounts,
        mail=mail,
        proxies=proxies,
        tasks=tasks,
    )
