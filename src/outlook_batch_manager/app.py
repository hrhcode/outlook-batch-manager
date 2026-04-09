from __future__ import annotations

import logging
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


def run_with_logging(project_root: Path, error_stream) -> int:
    log_dir = project_root / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "startup.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(error_stream),
        ],
    )
    try:
        logging.info("Application starting, project root: %s", project_root)
        return run()
    except Exception:
        logging.exception("Application startup failed")
        raise
