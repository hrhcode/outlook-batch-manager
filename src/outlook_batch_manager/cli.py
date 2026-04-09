from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.models import RegisterTaskConfig


def main() -> int:
    parser = argparse.ArgumentParser(prog="outlook-batch-manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser("snapshot", help="Export the current app state as JSON.")
    snapshot_parser.add_argument("--root", type=Path, default=Path.cwd())

    task_parser = subparsers.add_parser("run-task", help="Run a background task and return the created task id.")
    task_parser.add_argument("--root", type=Path, default=Path.cwd())
    task_parser.add_argument("--task-type", choices=["register", "login_check", "token_refresh"], required=True)
    task_parser.add_argument("--batch-size", type=int, default=5)
    task_parser.add_argument("--concurrent-workers", type=int, default=2)
    task_parser.add_argument("--max-retries", type=int, default=1)
    task_parser.add_argument("--fetch-token", action="store_true")
    task_parser.add_argument("--headless", action="store_true")

    settings_parser = subparsers.add_parser("save-settings", help="Save settings from a JSON file.")
    settings_parser.add_argument("--root", type=Path, default=Path.cwd())
    settings_parser.add_argument("--file", type=Path, required=True)

    import_accounts_parser = subparsers.add_parser("import-accounts", help="Import accounts from CSV or Excel.")
    import_accounts_parser.add_argument("--root", type=Path, default=Path.cwd())
    import_accounts_parser.add_argument("--file", type=Path, required=True)
    import_accounts_parser.add_argument("--source-name", default="import")

    export_accounts_parser = subparsers.add_parser("export-accounts", help="Export accounts to CSV or Excel.")
    export_accounts_parser.add_argument("--root", type=Path, default=Path.cwd())
    export_accounts_parser.add_argument("--file", type=Path, required=True)
    export_accounts_parser.add_argument("--keyword", default="")
    export_accounts_parser.add_argument("--status", default="")

    import_proxies_parser = subparsers.add_parser("import-proxies", help="Import proxies from a text file.")
    import_proxies_parser.add_argument("--root", type=Path, default=Path.cwd())
    import_proxies_parser.add_argument("--file", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "snapshot":
        return _snapshot(args.root)
    if args.command == "run-task":
        return _run_task(args)
    if args.command == "save-settings":
        return _save_settings(args.root, args.file)
    if args.command == "import-accounts":
        return _import_accounts(args.root, args.file, args.source_name)
    if args.command == "export-accounts":
        return _export_accounts(args.root, args.file, args.keyword, args.status)
    if args.command == "import-proxies":
        return _import_proxies(args.root, args.file)
    return 1


def _snapshot(root: Path) -> int:
    services = bootstrap_services(root)
    tasks = services.tasks.runner.list_tasks()
    payload = {
        "generated_at": _serialize_datetime(datetime.now()),
        "summary": {
            "account_count": len(services.accounts.list_account_summaries()),
            "proxy_count": len(services.proxies.list_proxies()),
            "task_count": len(tasks),
        },
        "accounts": [
            {
                **_serialize_account_summary(summary),
            }
            for summary in services.accounts.list_account_summaries()
        ],
        "tasks": [
            {
                "id": task.id,
                "task_type": task.task_type,
                "status": task.status,
                "success_count": task.success_count,
                "failure_count": task.failure_count,
                "started_at": _serialize_datetime(task.started_at),
                "finished_at": _serialize_datetime(task.finished_at),
                "latest_error": task.latest_error,
                "config_snapshot": task.config_snapshot,
                "recent_logs": [
                    {
                        "id": log.id,
                        "level": log.level,
                        "message": log.message,
                        "account_email": log.account_email,
                        "created_at": _serialize_datetime(log.created_at),
                    }
                    for log in services.tasks.runner.get_logs(task.id or 0, 8)
                ],
            }
            for task in tasks
        ],
        "proxies": [
            {
                "id": proxy.id,
                "server": proxy.server,
                "enabled": proxy.enabled,
                "status": proxy.status,
                "last_used_at": _serialize_datetime(proxy.last_used_at),
            }
            for proxy in services.proxies.list_proxies()
        ],
        "settings": services.settings.load(),
        "latest_task_summary": _serialize_latest_task(tasks[0] if tasks else None),
        "alerts": _build_alerts(tasks),
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def _run_task(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    task_id: int
    if args.task_type == "register":
        config = RegisterTaskConfig(
            batch_size=args.batch_size,
            concurrent_workers=args.concurrent_workers,
            max_retries=args.max_retries,
            fetch_token=bool(args.fetch_token),
            headless=bool(args.headless),
        )
        task_id = services.tasks.runner.run_registration_task(config)
    elif args.task_type == "login_check":
        task_id = services.tasks.runner.run_login_check_task()
    else:
        task_id = services.tasks.runner.run_token_refresh_task()
    print(json.dumps({"task_id": task_id}, ensure_ascii=False))
    return 0


def _save_settings(root: Path, file_path: Path) -> int:
    services = bootstrap_services(root)
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    current = services.settings.load()
    current.update(payload)
    services.settings.save(current)
    print(json.dumps({"saved": True}, ensure_ascii=False))
    return 0


def _import_accounts(root: Path, file_path: Path, source_name: str) -> int:
    services = bootstrap_services(root)
    imported = services.accounts.import_accounts(file_path, source_name=source_name)
    print(json.dumps({"imported": imported, "path": str(file_path)}, ensure_ascii=False))
    return 0


def _export_accounts(root: Path, file_path: Path, keyword: str, status: str) -> int:
    services = bootstrap_services(root)
    accounts = services.accounts.list_accounts(keyword=keyword)
    if status:
        accounts = [account for account in accounts if str(account.status) == status]
    services.accounts.export_accounts(file_path, accounts)
    print(json.dumps({"exported": len(accounts), "path": str(file_path)}, ensure_ascii=False))
    return 0


def _import_proxies(root: Path, file_path: Path) -> int:
    services = bootstrap_services(root)
    imported = services.proxies.import_lines(file_path.read_text(encoding="utf-8").splitlines())
    print(json.dumps({"imported": imported, "path": str(file_path)}, ensure_ascii=False))
    return 0


def _serialize_account_summary(summary) -> dict[str, Any]:
    account = summary.account
    return {
        "id": account.id,
        "email": account.email,
        "password": account.password,
        "status": account.status,
        "source": account.source,
        "group_name": account.group_name,
        "notes": account.notes,
        "recovery_email": account.recovery_email,
        "created_at": _serialize_datetime(account.created_at),
        "last_login_check_at": _serialize_datetime(account.last_login_check_at),
        "token_status": summary.token_status,
        "token_expires_at": _serialize_datetime(summary.token_expires_at),
    }


def _serialize_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat(timespec="seconds")


def _serialize_latest_task(task) -> dict[str, Any] | None:
    if task is None:
        return None
    return {
        "id": task.id,
        "task_type": task.task_type,
        "status": task.status,
        "success_count": task.success_count,
        "failure_count": task.failure_count,
        "finished_at": _serialize_datetime(task.finished_at),
        "latest_error": task.latest_error,
    }


def _build_alerts(tasks) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    for task in tasks[:5]:
        if task.latest_error:
            alerts.append(
                {
                    "kind": "error",
                    "title": f"任务 #{task.id} 执行异常",
                    "detail": task.latest_error,
                    "task_id": task.id,
                }
            )
    return alerts


if __name__ == "__main__":
    raise SystemExit(main())
