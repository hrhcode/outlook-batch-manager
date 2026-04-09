from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtWidgets import QApplication

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.ui.main_window import MainWindow


def run() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Outlook Batch Manager")
    app.setOrganizationName("hrhcode")

    services = bootstrap_services(Path.cwd())
    window = MainWindow(services)
    window.show()
    return app.exec()

