from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.models import Account, AccountStatus


def test_snapshot_cli_returns_current_state(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    services.accounts.upsert_account(
        Account(email="demo@example.com", password="Password123!", status=AccountStatus.ACTIVE)
    )

    result = subprocess.run(
        [sys.executable, "-m", "outlook_batch_manager.cli", "snapshot", "--root", str(tmp_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    assert payload["summary"]["account_count"] == 1
    assert payload["accounts"][0]["email"] == "demo@example.com"
