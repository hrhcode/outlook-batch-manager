from __future__ import annotations

import threading
from pathlib import Path

from PySide6.QtCore import QObject, Signal
from PySide6.QtWidgets import (
    QFileDialog,
    QHBoxLayout,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QSplitter,
    QStackedWidget,
    QWidget,
)

from outlook_batch_manager.bootstrap import ServiceContainer
from outlook_batch_manager.models import RegisterTaskConfig
from outlook_batch_manager.ui.pages import AccountsPage, DashboardPage, SettingsPage, TasksPage


class TaskSignals(QObject):
    progress = Signal(object)
    finished = Signal(str)
    error = Signal(str)


class MainWindow(QMainWindow):
    def __init__(self, services: ServiceContainer) -> None:
        super().__init__()
        self.services = services
        self.signals = TaskSignals()
        self.setWindowTitle("Outlook Batch Manager")
        self.resize(1360, 860)
        self._task_thread: threading.Thread | None = None
        self._build_ui()
        self._connect_signals()
        self.refresh_all()

    def _build_ui(self) -> None:
        root = QWidget(self)
        self.setCentralWidget(root)
        layout = QHBoxLayout(root)
        splitter = QSplitter(self)
        layout.addWidget(splitter)

        self.nav = QListWidget()
        self.nav.setFixedWidth(220)
        for title in ("仪表盘", "任务中心", "账号库", "系统设置"):
            QListWidgetItem(title, self.nav)

        self.stack = QStackedWidget()
        self.dashboard_page = DashboardPage()
        self.tasks_page = TasksPage()
        self.accounts_page = AccountsPage()
        self.settings_page = SettingsPage()
        for page in (self.dashboard_page, self.tasks_page, self.accounts_page, self.settings_page):
            self.stack.addWidget(page)

        splitter.addWidget(self.nav)
        splitter.addWidget(self.stack)
        splitter.setStretchFactor(1, 1)
        self.nav.setCurrentRow(0)

    def _connect_signals(self) -> None:
        self.nav.currentRowChanged.connect(self.stack.setCurrentIndex)
        self.accounts_page.import_requested.connect(self.import_accounts)
        self.accounts_page.export_requested.connect(self.export_accounts)
        self.accounts_page.refresh_requested.connect(self.refresh_accounts)
        self.tasks_page.run_register_requested.connect(self.run_register_task)
        self.tasks_page.run_login_check_requested.connect(self.run_login_check_task)
        self.tasks_page.run_token_refresh_requested.connect(self.run_token_refresh_task)
        self.tasks_page.import_proxy_requested.connect(self.import_proxies)
        self.tasks_page.refresh_requested.connect(self.refresh_tasks)
        self.settings_page.save_requested.connect(self.save_settings)
        self.signals.progress.connect(self.on_task_progress)
        self.signals.finished.connect(self.on_task_finished)
        self.signals.error.connect(self.on_task_error)

    def refresh_all(self) -> None:
        self.refresh_accounts()
        self.refresh_tasks()
        self.settings_page.set_settings(self.services.settings.load())

    def refresh_accounts(self) -> None:
        accounts = self.services.accounts.list_accounts(self.accounts_page.keyword())
        self.accounts_page.set_accounts(accounts)
        self.dashboard_page.update_summary(len(accounts), len(self.services.proxies.list_proxies()), len(self.services.tasks.runner.list_tasks()))

    def refresh_tasks(self) -> None:
        self.tasks_page.set_tasks(self.services.tasks.runner.list_tasks(), self.services.proxies.list_proxies())
        self.dashboard_page.update_summary(len(self.services.accounts.list_accounts()), len(self.services.proxies.list_proxies()), len(self.services.tasks.runner.list_tasks()))

    def save_settings(self, settings: dict) -> None:
        current = self.services.settings.load()
        current.update(settings)
        self.services.settings.save(current)
        QMessageBox.information(self, "保存成功", "系统设置已保存。")

    def import_accounts(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "导入账号", str(Path.cwd()), "表格文件 (*.csv *.xlsx)")
        if not path:
            return
        count = self.services.accounts.import_accounts(Path(path))
        self.refresh_accounts()
        QMessageBox.information(self, "导入完成", f"成功导入 {count} 条账号。")

    def export_accounts(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, "导出账号", str(Path.cwd() / "accounts.xlsx"), "Excel (*.xlsx);;CSV (*.csv)")
        if not path:
            return
        self.services.accounts.export_accounts(Path(path), self.services.accounts.list_accounts(self.accounts_page.keyword()))
        QMessageBox.information(self, "导出完成", f"账号已导出到:\n{path}")

    def import_proxies(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "导入代理列表", str(Path.cwd()), "文本文件 (*.txt);;全部文件 (*.*)")
        if not path:
            return
        count = self.services.proxies.import_lines(Path(path).read_text(encoding="utf-8").splitlines())
        self.refresh_tasks()
        QMessageBox.information(self, "代理导入完成", f"新增 {count} 条代理。")

    def run_register_task(self, config: dict) -> None:
        self.tasks_page.show_running_hint("正在执行批量注册任务...")
        self._start_background_task(
            lambda: self.services.tasks.runner.run_registration_task(RegisterTaskConfig(**config), self.signals.progress.emit),
            "批量注册任务已完成。",
        )

    def run_login_check_task(self) -> None:
        self.tasks_page.show_running_hint("正在执行登录校验任务...")
        self._start_background_task(
            lambda: self.services.tasks.runner.run_login_check_task(self.signals.progress.emit),
            "登录校验任务已完成。",
        )

    def run_token_refresh_task(self) -> None:
        self.tasks_page.show_running_hint("正在执行 Token 刷新任务...")
        self._start_background_task(
            lambda: self.services.tasks.runner.run_token_refresh_task(self.signals.progress.emit),
            "Token 刷新任务已完成。",
        )

    def _start_background_task(self, job, success_message: str) -> None:
        if self._task_thread and self._task_thread.is_alive():
            QMessageBox.warning(self, "任务进行中", "当前已有任务在运行，请等待完成后再启动新任务。")
            return

        def runner() -> None:
            try:
                job()
            except Exception as exc:  # pragma: no cover - UI feedback
                self.signals.error.emit(str(exc))
                return
            self.signals.finished.emit(success_message)

        self._task_thread = threading.Thread(target=runner, daemon=True)
        self._task_thread.start()

    def on_task_progress(self, progress) -> None:
        self.tasks_page.set_task_progress(progress)
        self.refresh_tasks()

    def on_task_finished(self, message: str) -> None:
        self.refresh_all()
        self.statusBar().showMessage(message, 5000)

    def on_task_error(self, message: str) -> None:
        QMessageBox.critical(self, "任务执行失败", message)
