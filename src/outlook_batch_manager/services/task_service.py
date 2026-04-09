from __future__ import annotations

from outlook_batch_manager.automation.runner import TaskRunner
from outlook_batch_manager.services.account_service import AccountService
from outlook_batch_manager.services.mail_service import MailService
from outlook_batch_manager.services.proxy_service import ProxyService
from outlook_batch_manager.services.settings_service import SettingsService
from outlook_batch_manager.storage.database import Database


class TaskService:
    def __init__(
        self,
        database: Database,
        accounts: AccountService,
        mail: MailService,
        proxies: ProxyService,
        settings: SettingsService,
    ) -> None:
        self.database = database
        self.accounts = accounts
        self.mail = mail
        self.proxies = proxies
        self.settings = settings
        self.runner = TaskRunner(database, accounts, mail, proxies, settings)
