from __future__ import annotations

import sys
from pathlib import Path

from outlook_batch_manager.app import run_with_logging


if __name__ == "__main__":
    project_root = Path(__file__).resolve().parent
    raise SystemExit(run_with_logging(project_root, sys.stderr))
