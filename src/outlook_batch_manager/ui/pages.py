from __future__ import annotations

from datetime import datetime

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPlainTextEdit,
    QPushButton,
    QSpinBox,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from outlook_batch_manager.models import AccountSummary, ProxyRecord, TaskProgress, TaskRecord


class DashboardPage(QWidget):
    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        self.summary = QLabel("欢迎使用 Outlook Batch Manager。")
        self.summary.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self.summary.setWordWrap(True)
        layout.addWidget(self.summary)
        layout.addStretch(1)

    def update_summary(self, account_count: int, proxy_count: int, task_count: int) -> None:
        self.summary.setText(
            "\n".join(
                [
                    "系统概览",
                    f"- 账号数量: {account_count}",
                    f"- 代理数量: {proxy_count}",
                    f"- 任务数量: {task_count}",
                    "",
                    "V1 支持批量注册、登录校验、Token 刷新、账号导入导出与代理池管理。",
                ]
            )
        )


class TasksPage(QWidget):
    run_register_requested = Signal(dict)
    run_login_check_requested = Signal()
    run_token_refresh_requested = Signal()
    import_proxy_requested = Signal()
    refresh_requested = Signal()

    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)

        config_group = QGroupBox("注册任务配置")
        config_layout = QFormLayout(config_group)
        self.batch_size = QSpinBox()
        self.batch_size.setRange(1, 1000)
        self.batch_size.setValue(5)
        self.concurrent_workers = QSpinBox()
        self.concurrent_workers.setRange(1, 16)
        self.concurrent_workers.setValue(2)
        self.max_retries = QSpinBox()
        self.max_retries.setRange(0, 5)
        self.max_retries.setValue(1)
        self.fetch_token = QCheckBox("注册后获取/刷新 Token")
        self.fetch_token.setChecked(True)
        self.headless = QCheckBox("无头模式")
        config_layout.addRow("批量数量", self.batch_size)
        config_layout.addRow("并发数", self.concurrent_workers)
        config_layout.addRow("失败重试次数", self.max_retries)
        config_layout.addRow("", self.fetch_token)
        config_layout.addRow("", self.headless)
        layout.addWidget(config_group)

        buttons = QHBoxLayout()
        register_button = QPushButton("开始批量注册")
        login_check_button = QPushButton("执行登录校验")
        token_button = QPushButton("执行 Token 刷新")
        proxy_button = QPushButton("导入代理池")
        refresh_button = QPushButton("刷新任务视图")
        for button in (register_button, login_check_button, token_button, proxy_button, refresh_button):
            buttons.addWidget(button)
        layout.addLayout(buttons)

        self.hint = QLabel()
        layout.addWidget(self.hint)

        self.task_table = QTableWidget(0, 7)
        self.task_table.setHorizontalHeaderLabels(["ID", "类型", "状态", "成功", "失败", "开始时间", "最新错误"])
        self.task_table.horizontalHeader().setStretchLastSection(True)
        layout.addWidget(self.task_table, 2)

        proxy_group = QGroupBox("代理池")
        proxy_layout = QVBoxLayout(proxy_group)
        self.proxy_table = QTableWidget(0, 4)
        self.proxy_table.setHorizontalHeaderLabels(["ID", "代理地址", "状态", "最后使用"])
        self.proxy_table.horizontalHeader().setStretchLastSection(True)
        proxy_layout.addWidget(self.proxy_table)
        layout.addWidget(proxy_group, 1)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text, 2)

        register_button.clicked.connect(self._emit_register)
        login_check_button.clicked.connect(self.run_login_check_requested.emit)
        token_button.clicked.connect(self.run_token_refresh_requested.emit)
        proxy_button.clicked.connect(self.import_proxy_requested.emit)
        refresh_button.clicked.connect(self.refresh_requested.emit)

    def _emit_register(self) -> None:
        self.run_register_requested.emit(
            {
                "batch_size": self.batch_size.value(),
                "concurrent_workers": self.concurrent_workers.value(),
                "max_retries": self.max_retries.value(),
                "fetch_token": self.fetch_token.isChecked(),
                "headless": self.headless.isChecked(),
            }
        )

    def set_tasks(self, tasks: list[TaskRecord], proxies: list[ProxyRecord]) -> None:
        self.task_table.setRowCount(len(tasks))
        for row_index, task in enumerate(tasks):
            values = [
                str(task.id or ""),
                task.task_type,
                task.status,
                str(task.success_count),
                str(task.failure_count),
                task.started_at.isoformat(sep=" ", timespec="seconds") if task.started_at else "",
                task.latest_error,
            ]
            for column_index, value in enumerate(values):
                self.task_table.setItem(row_index, column_index, QTableWidgetItem(value))

        self.proxy_table.setRowCount(len(proxies))
        for row_index, proxy in enumerate(proxies):
            values = [
                str(proxy.id or ""),
                proxy.server,
                proxy.status,
                proxy.last_used_at.isoformat(sep=" ", timespec="seconds") if proxy.last_used_at else "",
            ]
            for column_index, value in enumerate(values):
                self.proxy_table.setItem(row_index, column_index, QTableWidgetItem(value))

    def set_task_progress(self, progress: TaskProgress) -> None:
        lines = [
            f"任务 #{progress.task_id} | {progress.task_type} | {progress.status}",
            f"成功 {progress.success_count} / 失败 {progress.failure_count}",
            progress.latest_message,
            "",
        ]
        for log in progress.recent_logs:
            timestamp = log.created_at.isoformat(sep=" ", timespec="seconds") if log.created_at else datetime.now().isoformat(sep=" ", timespec="seconds")
            lines.append(f"[{timestamp}] {log.level} {log.account_email} {log.message}".strip())
        self.log_text.setPlainText("\n".join(lines))

    def show_running_hint(self, message: str) -> None:
        self.hint.setText(message)


class AccountsPage(QWidget):
    import_requested = Signal()
    export_requested = Signal()
    refresh_requested = Signal()

    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        row = QHBoxLayout()
        self.search = QLineEdit()
        self.search.setPlaceholderText("按邮箱、分组、备注筛选")
        refresh_button = QPushButton("刷新")
        import_button = QPushButton("导入账号")
        export_button = QPushButton("导出账号")
        for widget in (self.search, refresh_button, import_button, export_button):
            row.addWidget(widget)
        layout.addLayout(row)

        self.table = QTableWidget(0, 10)
        self.table.setHorizontalHeaderLabels(["邮箱", "密码", "状态", "Token 状态", "Token 过期", "来源", "分组", "恢复邮箱", "上次校验", "备注"])
        self.table.horizontalHeader().setStretchLastSection(True)
        layout.addWidget(self.table)

        refresh_button.clicked.connect(self.refresh_requested.emit)
        import_button.clicked.connect(self.import_requested.emit)
        export_button.clicked.connect(self.export_requested.emit)
        self.search.returnPressed.connect(self.refresh_requested.emit)

    def keyword(self) -> str:
        return self.search.text().strip()

    def set_accounts(self, accounts: list[AccountSummary]) -> None:
        self.table.setRowCount(len(accounts))
        for row_index, summary in enumerate(accounts):
            account = summary.account
            values = [
                account.email,
                account.password,
                account.status,
                summary.token_status,
                summary.token_expires_at.isoformat(sep=" ", timespec="seconds") if summary.token_expires_at else "",
                account.source,
                account.group_name,
                account.recovery_email,
                account.last_login_check_at.isoformat(sep=" ", timespec="seconds") if account.last_login_check_at else "",
                account.notes,
            ]
            for column_index, value in enumerate(values):
                self.table.setItem(row_index, column_index, QTableWidgetItem(value))


class SettingsPage(QWidget):
    save_requested = Signal(dict)

    def __init__(self) -> None:
        super().__init__()
        layout = QVBoxLayout(self)
        group = QGroupBox("系统设置")
        form = QFormLayout(group)
        self.browser_path = QLineEdit()
        self.user_agent = QLineEdit()
        self.timeout_ms = QSpinBox()
        self.timeout_ms.setRange(5000, 120000)
        self.timeout_ms.setValue(30000)
        self.captcha_wait_ms = QSpinBox()
        self.captcha_wait_ms.setRange(1000, 60000)
        self.captcha_wait_ms.setValue(12000)
        self.headless = QCheckBox("无头模式")
        self.use_mock_driver = QCheckBox("使用模拟驱动（建议先开启）")
        self.use_mock_driver.setChecked(True)
        self.client_id = QLineEdit()
        self.redirect_url = QLineEdit()
        self.scopes = QPlainTextEdit()
        self.scopes.setPlaceholderText("每行一个 Scope")
        form.addRow("浏览器路径", self.browser_path)
        form.addRow("自定义 User-Agent", self.user_agent)
        form.addRow("页面超时(ms)", self.timeout_ms)
        form.addRow("验证码等待(ms)", self.captcha_wait_ms)
        form.addRow("", self.headless)
        form.addRow("", self.use_mock_driver)
        form.addRow("Azure Client ID", self.client_id)
        form.addRow("Redirect URL", self.redirect_url)
        form.addRow("Scopes", self.scopes)
        layout.addWidget(group)
        save_button = QPushButton("保存设置")
        layout.addWidget(save_button, alignment=Qt.AlignLeft)
        layout.addStretch(1)
        save_button.clicked.connect(self._emit_save)

    def set_settings(self, settings: dict) -> None:
        self.browser_path.setText(settings.get("browser_executable_path", ""))
        self.user_agent.setText(settings.get("user_agent", ""))
        self.timeout_ms.setValue(int(settings.get("timeout_ms", 30000)))
        self.captcha_wait_ms.setValue(int(settings.get("captcha_wait_ms", 12000)))
        self.headless.setChecked(bool(settings.get("headless", False)))
        self.use_mock_driver.setChecked(bool(settings.get("use_mock_driver", True)))
        self.client_id.setText(settings.get("client_id", ""))
        self.redirect_url.setText(settings.get("redirect_url", ""))
        self.scopes.setPlainText("\n".join(settings.get("scopes", [])))

    def _emit_save(self) -> None:
        self.save_requested.emit(
            {
                "browser_executable_path": self.browser_path.text().strip(),
                "user_agent": self.user_agent.text().strip(),
                "timeout_ms": self.timeout_ms.value(),
                "captcha_wait_ms": self.captcha_wait_ms.value(),
                "headless": self.headless.isChecked(),
                "use_mock_driver": self.use_mock_driver.isChecked(),
                "client_id": self.client_id.text().strip(),
                "redirect_url": self.redirect_url.text().strip(),
                "scopes": [line.strip() for line in self.scopes.toPlainText().splitlines() if line.strip()],
            }
        )
