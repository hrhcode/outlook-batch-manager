from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.models import Account, AccountStatus


def run_cli(*args: str) -> dict:
    result = subprocess.run(
        [sys.executable, "-m", "outlook_batch_manager.cli", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_snapshot_cli_returns_current_state(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    services.accounts.upsert_account(
        Account(email="demo@example.com", password="Password123!", status=AccountStatus.ACTIVE)
    )

    payload = run_cli("snapshot", "--root", str(tmp_path))
    assert payload["summary"]["account_count"] == 1
    assert payload["accounts"][0]["email"] == "demo@example.com"
    assert payload["latest_task_summary"] is None


def test_import_accounts_cli_imports_csv(tmp_path: Path) -> None:
    source = tmp_path / "accounts.csv"
    with source.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["email", "password", "status", "group_name", "notes", "recovery_email"],
        )
        writer.writeheader()
        writer.writerow(
            {
                "email": "imported@example.com",
                "password": "Password123!",
                "status": "active",
                "group_name": "team-a",
                "notes": "seed",
                "recovery_email": "restore@example.com",
            }
        )

    payload = run_cli("import-accounts", "--root", str(tmp_path), "--file", str(source))
    assert payload["imported"] == 1
    snapshot = run_cli("snapshot", "--root", str(tmp_path))
    assert snapshot["summary"]["account_count"] == 1
    assert snapshot["accounts"][0]["group_name"] == "team-a"


def test_export_accounts_cli_exports_filtered_rows(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    services.accounts.upsert_account(
        Account(email="active@example.com", password="Password123!", status=AccountStatus.ACTIVE)
    )
    services.accounts.upsert_account(
        Account(email="pending@example.com", password="Password123!", status=AccountStatus.PENDING)
    )

    destination = tmp_path / "filtered.csv"
    payload = run_cli(
        "export-accounts",
        "--root",
        str(tmp_path),
        "--file",
        str(destination),
        "--status",
        "active",
    )
    assert payload["exported"] == 1
    with destination.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    assert rows[0]["email"] == "active@example.com"


def test_import_proxies_cli_imports_text_file(tmp_path: Path) -> None:
    source = tmp_path / "proxies.txt"
    source.write_text("http://127.0.0.1:9001\nhttp://127.0.0.1:9002\n", encoding="utf-8")

    payload = run_cli("import-proxies", "--root", str(tmp_path), "--file", str(source))
    assert payload["imported"] == 2
    snapshot = run_cli("snapshot", "--root", str(tmp_path))
    assert snapshot["summary"]["proxy_count"] == 2


def test_create_account_and_test_account_cli(tmp_path: Path) -> None:
    created = run_cli(
        "create-account",
        "--root",
        str(tmp_path),
        "--email",
        "manual@example.com",
        "--password",
        "Password123!",
        "--provider",
        "outlook",
    )
    account_id = created["account"]["id"]
    payload = run_cli("test-account", "--root", str(tmp_path), "--account-id", str(account_id))
    assert payload["success"] is True
    assert payload["connectivity_status"] == "connected"


def test_sync_mail_and_list_mail_cli(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    created = services.accounts.create_account(
        email="mail@example.com",
        password="Password123!",
    )
    services.settings.save({"use_mock_driver": True})

    payload = run_cli("sync-mail", "--root", str(tmp_path), "--account-id", str(created.id or 0))
    assert payload["task_id"] > 0
    mail_payload = run_cli("list-mail", "--root", str(tmp_path), "--account-id", str(created.id or 0))
    assert len(mail_payload["messages"]) > 0
