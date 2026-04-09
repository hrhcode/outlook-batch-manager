from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.models import MailSource, RegisterTaskConfig


def main() -> int:
    parser = argparse.ArgumentParser(prog="outlook-batch-manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser("snapshot", help="Export the current app state as JSON.")
    snapshot_parser.add_argument("--root", type=Path, default=Path.cwd())

    task_parser = subparsers.add_parser("run-task", help="Run a background task and return the created task id.")
    task_parser.add_argument("--root", type=Path, default=Path.cwd())
    task_parser.add_argument("--task-type", choices=["register", "login_check", "token_refresh", "mail_sync"], required=True)
    task_parser.add_argument("--batch-size", type=int, default=5)
    task_parser.add_argument("--concurrent-workers", type=int, default=2)
    task_parser.add_argument("--max-retries", type=int, default=1)
    task_parser.add_argument("--fetch-token", action="store_true")
    task_parser.add_argument("--headless", action="store_true")
    task_parser.add_argument("--account-id", type=int)
    task_parser.add_argument("--source", choices=["auto", "graph", "imap", "pop"], default="auto")
    task_parser.add_argument("--limit", type=int, default=20)
    task_parser.add_argument("--unread-only", action="store_true")

    settings_parser = subparsers.add_parser("save-settings", help="Save settings from a JSON file.")
    settings_parser.add_argument("--root", type=Path, default=Path.cwd())
    settings_parser.add_argument("--file", type=Path, required=True)

    import_accounts_parser = subparsers.add_parser("import-accounts", help="Import accounts from CSV, Excel, or text.")
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

    create_account_parser = subparsers.add_parser("create-account", help="Create a single account.")
    create_account_parser.add_argument("--root", type=Path, default=Path.cwd())
    create_account_parser.add_argument("--email", required=True)
    create_account_parser.add_argument("--password", required=True)
    create_account_parser.add_argument("--provider", default="outlook")
    create_account_parser.add_argument("--group", dest="group_name", default="default")
    create_account_parser.add_argument("--notes", default="")
    create_account_parser.add_argument("--recovery-email", default="")
    create_account_parser.add_argument("--client-id-override", default="")
    create_account_parser.add_argument("--refresh-token", default="")

    test_account_parser = subparsers.add_parser("test-account", help="Verify connectivity for one account.")
    test_account_parser.add_argument("--root", type=Path, default=Path.cwd())
    test_account_parser.add_argument("--account-id", type=int, required=True)

    sync_mail_parser = subparsers.add_parser("sync-mail", help="Sync mailbox data for one or more accounts.")
    sync_mail_parser.add_argument("--root", type=Path, default=Path.cwd())
    sync_mail_parser.add_argument("--account-id", type=int)
    sync_mail_parser.add_argument("--source", choices=["auto", "graph", "imap", "pop"], default="auto")
    sync_mail_parser.add_argument("--limit", type=int, default=20)
    sync_mail_parser.add_argument("--unread-only", action="store_true")

    list_mail_parser = subparsers.add_parser("list-mail", help="List synced mailbox data.")
    list_mail_parser.add_argument("--root", type=Path, default=Path.cwd())
    list_mail_parser.add_argument("--account-id", type=int)
    list_mail_parser.add_argument("--keyword", default="")
    list_mail_parser.add_argument("--unread-only", action="store_true")
    list_mail_parser.add_argument("--source", default="")

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
    if args.command == "create-account":
        return _create_account(args)
    if args.command == "test-account":
        return _test_account(args.root, args.account_id)
    if args.command == "sync-mail":
        return _sync_mail(args.root, args.account_id, args.source, args.limit, args.unread_only)
    if args.command == "list-mail":
        return _list_mail(args.root, args.account_id, args.keyword, args.unread_only, args.source)
    return 1


def _snapshot(root: Path) -> int:
    services = bootstrap_services(root)
    account_summaries = services.accounts.list_account_summaries()
    tasks = services.tasks.runner.list_tasks()
    mail_summary = services.mail.summarize()
    payload = {
        "generated_at": _serialize_datetime(datetime.now()),
        "summary": {
            "account_count": len(account_summaries),
            "proxy_count": len(services.proxies.list_proxies()),
            "task_count": len(tasks),
            "active_account_count": len([item for item in account_summaries if str(item.account.status) == "active"]),
            "pending_account_count": len([item for item in account_summaries if str(item.account.status) == "pending"]),
            "connected_account_count": len(
                [item for item in account_summaries if str(item.account.connectivity_status) == "connected"]
            ),
        },
        "accounts": [_serialize_account_summary(summary) for summary in account_summaries],
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
        "mail_summary": mail_summary,
        "recent_mail_sync": [services.mail._serialize_run(run) for run in services.mail.list_sync_runs(5)],
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def _run_task(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
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
        account_ids = [args.account_id] if args.account_id else None
        task_id = services.tasks.runner.run_login_check_task(account_ids=account_ids)
    elif args.task_type == "token_refresh":
        task_id = services.tasks.runner.run_token_refresh_task()
    else:
        task_id = services.tasks.runner.run_mail_sync_task(
            account_id=args.account_id,
            source=MailSource(args.source),
            limit=args.limit,
            unread_only=bool(args.unread_only),
        )
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
    accounts = services.accounts.list_accounts(keyword=keyword, status=status)
    services.accounts.export_accounts(file_path, accounts)
    print(json.dumps({"exported": len(accounts), "path": str(file_path)}, ensure_ascii=False))
    return 0


def _import_proxies(root: Path, file_path: Path) -> int:
    services = bootstrap_services(root)
    imported = services.proxies.import_lines(file_path.read_text(encoding="utf-8").splitlines())
    print(json.dumps({"imported": imported, "path": str(file_path)}, ensure_ascii=False))
    return 0


def _create_account(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    created = services.accounts.create_account(
        email=args.email,
        password=args.password,
        provider=args.provider,
        group_name=args.group_name,
        notes=args.notes,
        recovery_email=args.recovery_email,
        client_id_override=args.client_id_override,
        refresh_token=args.refresh_token,
    )
    print(
        json.dumps(
            {
                "created": True,
                "account": _serialize_account_summary(
                    services.accounts.list_account_summaries(keyword=created.email)[0]
                ),
            },
            ensure_ascii=False,
        )
    )
    return 0


def _test_account(root: Path, account_id: int) -> int:
    services = bootstrap_services(root)
    payload = services.tasks.runner.test_account_connectivity(account_id)
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def _sync_mail(root: Path, account_id: int | None, source: str, limit: int, unread_only: bool) -> int:
    services = bootstrap_services(root)
    task_id = services.tasks.runner.run_mail_sync_task(
        account_id=account_id,
        source=MailSource(source),
        limit=limit,
        unread_only=unread_only,
    )
    latest_run = services.mail.list_sync_runs(1)
    print(
        json.dumps(
            {
                "task_id": task_id,
                "latest_run": services.mail._serialize_run(latest_run[0]) if latest_run else None,
            },
            ensure_ascii=False,
        )
    )
    return 0


def _list_mail(root: Path, account_id: int | None, keyword: str, unread_only: bool, source: str) -> int:
    services = bootstrap_services(root)
    payload = {
        "messages": services.mail.list_messages(
            account_id=account_id,
            keyword=keyword,
            unread_only=unread_only,
            source=source,
        )
    }
    print(json.dumps(payload, ensure_ascii=False))
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
        "mail_provider": account.mail_provider,
        "client_id_override": account.client_id_override,
        "import_format": account.import_format,
        "connectivity_status": account.connectivity_status,
        "created_at": _serialize_datetime(account.created_at),
        "last_login_check_at": _serialize_datetime(account.last_login_check_at),
        "last_connectivity_check_at": _serialize_datetime(account.last_login_check_at),
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
