from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.models import ConnectivityStatus, RegisterTaskConfig, TokenRecord, TokenStatus


def main() -> int:
    parser = argparse.ArgumentParser(prog="outlook-batch-manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser("snapshot")
    snapshot_parser.add_argument("--root", type=Path, default=Path.cwd())

    settings_parser = subparsers.add_parser("save-settings")
    settings_parser.add_argument("--root", type=Path, default=Path.cwd())
    settings_parser.add_argument("--file", type=Path, required=True)

    create_auth_parser = subparsers.add_parser("create-auth-url")
    create_auth_parser.add_argument("--root", type=Path, default=Path.cwd())
    create_auth_parser.add_argument("--account-id", type=int, required=True)

    complete_oauth_parser = subparsers.add_parser("complete-oauth")
    complete_oauth_parser.add_argument("--root", type=Path, default=Path.cwd())
    complete_oauth_parser.add_argument("--session-id", required=True)
    complete_oauth_parser.add_argument("--code", required=True)
    complete_oauth_parser.add_argument("--state", required=True)

    list_accounts_parser = subparsers.add_parser("list-accounts")
    list_accounts_parser.add_argument("--root", type=Path, default=Path.cwd())

    test_account_mail_parser = subparsers.add_parser("test-account-mail-capability")
    test_account_mail_parser.add_argument("--root", type=Path, default=Path.cwd())
    test_account_mail_parser.add_argument("--account-id", type=int, required=True)

    delete_accounts_parser = subparsers.add_parser("delete-accounts")
    delete_accounts_parser.add_argument("--root", type=Path, default=Path.cwd())
    delete_accounts_parser.add_argument("--account-ids", required=True)

    list_mail_parser = subparsers.add_parser("list-mail")
    list_mail_parser.add_argument("--root", type=Path, default=Path.cwd())
    list_mail_parser.add_argument("--account-id", type=int)
    list_mail_parser.add_argument("--keyword", default="")
    list_mail_parser.add_argument("--unread-only", action="store_true")
    list_mail_parser.add_argument("--source", default="")

    sync_mail_batch_parser = subparsers.add_parser("sync-mail-batch")
    sync_mail_batch_parser.add_argument("--root", type=Path, default=Path.cwd())
    sync_mail_batch_parser.add_argument("--account-ids", required=True)
    sync_mail_batch_parser.add_argument("--limit", type=int)

    sync_mail_due_parser = subparsers.add_parser("sync-mail-due")
    sync_mail_due_parser.add_argument("--root", type=Path, default=Path.cwd())

    update_account_auth_parser = subparsers.add_parser("update-account-auth")
    update_account_auth_parser.add_argument("--root", type=Path, default=Path.cwd())
    update_account_auth_parser.add_argument("--account-id", type=int, required=True)
    update_account_auth_parser.add_argument("--client-id", default="")
    update_account_auth_parser.add_argument("--refresh-token", default="")

    legacy_create_account_parser = subparsers.add_parser("create-account")
    legacy_create_account_parser.add_argument("--root", type=Path, default=Path.cwd())
    legacy_create_account_parser.add_argument("--email", required=True)
    legacy_create_account_parser.add_argument("--password", required=True)
    legacy_create_account_parser.add_argument("--provider", default="outlook")

    import_accounts_parser = subparsers.add_parser("import-accounts")
    import_accounts_parser.add_argument("--root", type=Path, default=Path.cwd())
    import_accounts_parser.add_argument("--file", type=Path, required=True)
    import_accounts_parser.add_argument("--source-name", default="import")

    export_accounts_parser = subparsers.add_parser("export-accounts")
    export_accounts_parser.add_argument("--root", type=Path, default=Path.cwd())
    export_accounts_parser.add_argument("--file", type=Path, required=True)
    export_accounts_parser.add_argument("--keyword", default="")
    export_accounts_parser.add_argument("--status", default="")

    import_proxies_parser = subparsers.add_parser("import-proxies")
    import_proxies_parser.add_argument("--root", type=Path, default=Path.cwd())
    import_proxies_parser.add_argument("--file", type=Path, required=True)

    run_task_parser = subparsers.add_parser("run-task")
    run_task_parser.add_argument("--root", type=Path, default=Path.cwd())
    run_task_parser.add_argument("--task-type", choices=["register", "login_check"], required=True)
    run_task_parser.add_argument("--batch-size", type=int, default=5)
    run_task_parser.add_argument("--concurrent-workers", type=int, default=2)
    run_task_parser.add_argument("--max-retries", type=int, default=1)
    run_task_parser.add_argument("--fetch-token", action="store_true")
    run_task_parser.add_argument("--headless", action="store_true")
    run_task_parser.add_argument("--account-id", type=int)

    args = parser.parse_args()
    command_map = {
        "snapshot": _snapshot,
        "save-settings": _save_settings,
        "create-auth-url": _create_auth_url,
        "complete-oauth": _complete_oauth,
        "list-accounts": _list_accounts,
        "test-account-mail-capability": _test_account_mail_capability,
        "delete-accounts": _delete_accounts,
        "list-mail": _list_mail,
        "sync-mail-batch": _sync_mail_batch,
        "sync-mail-due": _sync_mail_due,
        "update-account-auth": _update_account_auth,
        "create-account": _legacy_create_account,
        "import-accounts": _import_accounts,
        "export-accounts": _export_accounts,
        "import-proxies": _import_proxies,
        "run-task": _run_task,
    }
    return command_map[args.command](args)


def _snapshot(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    legacy_tasks = services.tasks.runner.list_tasks()
    accounts = [_serialize_account_summary(item) for item in services.accounts.list_account_summaries()]
    payload = {
        "generated_at": _serialize_datetime(datetime.now()),
        "summary": {
            "account_count": len(accounts),
            "connected_account_count": len([item for item in accounts if item["connectivity_status"] == "connected"]),
            "connectable_count": len([item for item in accounts if item["connectivity_status"] == "connectable"]),
            "action_required_count": len([item for item in accounts if item["connectivity_status"] == "action_required"]),
            "proxy_count": len(services.proxies.list_proxies()),
            "legacy_task_count": len(legacy_tasks),
        },
        "accounts": accounts,
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
                    for log in services.tasks.runner.get_logs(task.id or 0, 6)
                ],
            }
            for task in legacy_tasks
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
        "mail_summary": services.mail.summarize(),
        "recent_mail_sync": [services.mail._serialize_run(run) for run in services.mail.list_sync_runs(8)],
        "alerts": _build_alerts(accounts),
        "latest_task_summary": _serialize_latest_task(legacy_tasks[0] if legacy_tasks else None),
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def _save_settings(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    payload = json.loads(args.file.read_text(encoding="utf-8"))
    current = services.settings.load()
    current.update(payload)
    services.settings.save(current)
    print(json.dumps({"saved": True}, ensure_ascii=False))
    return 0


def _create_auth_url(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    print(json.dumps(services.mail.create_auth_session(args.account_id), ensure_ascii=False))
    return 0


def _complete_oauth(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    print(json.dumps(services.mail.complete_oauth(args.session_id, args.code, args.state), ensure_ascii=False))
    return 0


def _list_accounts(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    payload = {"accounts": [_serialize_account_summary(item) for item in services.accounts.list_account_summaries()]}
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def _test_account_mail_capability(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    print(json.dumps(services.mail.test_account_capability(args.account_id), ensure_ascii=False))
    return 0


def _delete_accounts(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    account_ids = [int(item.strip()) for item in args.account_ids.split(",") if item.strip()]
    deleted = services.accounts.delete_accounts(account_ids)
    print(json.dumps({"deleted": deleted}, ensure_ascii=False))
    return 0


def _list_mail(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    print(
        json.dumps(
            {
                "messages": services.mail.list_messages(
                    account_id=args.account_id,
                    keyword=args.keyword,
                    unread_only=bool(args.unread_only),
                    source=args.source,
                ),
            },
            ensure_ascii=False,
        )
    )
    return 0


def _sync_mail_batch(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    account_ids = [int(item.strip()) for item in args.account_ids.split(",") if item.strip()]
    print(json.dumps(services.mail.sync_accounts(account_ids, args.limit), ensure_ascii=False))
    return 0


def _sync_mail_due(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    print(json.dumps(services.mail.sync_due_accounts(), ensure_ascii=False))
    return 0


def _update_account_auth(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    account = services.accounts.get_account(args.account_id)
    if account is None:
        raise RuntimeError("账号不存在。")
    account.client_id_override = args.client_id.strip()
    updated = services.accounts.upsert_account(account)
    if args.refresh_token.strip():
        token = services.accounts.get_token(updated.id or 0) or TokenRecord(account_id=updated.id or 0)
        token.refresh_token = args.refresh_token.strip()
        token.status = TokenStatus.STORED
        services.accounts.save_token(token)
    current_token = services.accounts.get_token(updated.id or 0)
    has_refresh_token = bool((current_token.refresh_token if current_token else "").strip())
    services.accounts.update_account_runtime(
        updated.id or 0,
        connectivity_status=ConnectivityStatus.CONNECTABLE if updated.client_id_override.strip() and has_refresh_token else ConnectivityStatus.ACTION_REQUIRED,
        last_error="",
    )
    print(json.dumps({"updated": True, "account_id": updated.id}, ensure_ascii=False))
    return 0


def _legacy_create_account(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    created = services.accounts.create_account(email=args.email, password=args.password, provider=args.provider)
    print(json.dumps({"created": True, "account": {"id": created.id, "email": created.email}}, ensure_ascii=False))
    return 0


def _import_accounts(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    imported = services.accounts.import_accounts(args.file, source_name=args.source_name)
    print(json.dumps({"imported": imported, "path": str(args.file)}, ensure_ascii=False))
    return 0


def _export_accounts(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    accounts = services.accounts.list_accounts(keyword=args.keyword, status=args.status)
    services.accounts.export_accounts(args.file, accounts)
    print(json.dumps({"exported": len(accounts), "path": str(args.file)}, ensure_ascii=False))
    return 0


def _import_proxies(args: argparse.Namespace) -> int:
    services = bootstrap_services(args.root)
    imported = services.proxies.import_lines(args.file.read_text(encoding="utf-8").splitlines())
    print(json.dumps({"imported": imported, "path": str(args.file)}, ensure_ascii=False))
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
    else:
        account_ids = [args.account_id] if args.account_id else None
        task_id = services.tasks.runner.run_login_check_task(account_ids=account_ids)
    print(json.dumps({"task_id": task_id}, ensure_ascii=False))
    return 0


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat(timespec="seconds") if value else None


def _build_alerts(accounts: list[dict]) -> list[dict]:
    alerts: list[dict] = []
    for account in accounts[:8]:
        if account["last_error"]:
            alerts.append(
                {
                    "kind": "error",
                    "title": f"{account['email']} 需要处理",
                    "detail": account["last_error"],
                }
            )
    return alerts


def _serialize_account_summary(summary) -> dict:
    account = summary.account
    return {
        "id": account.id,
        "email": account.email,
        "status": account.status,
        "group_name": account.group_name,
        "notes": account.notes,
        "recovery_email": account.recovery_email,
        "mail_provider": account.mail_provider,
        "import_format": account.import_format,
        "connectivity_status": account.connectivity_status,
        "mail_capability_status": account.mail_capability_status,
        "last_connectivity_check_at": _serialize_datetime(account.last_login_check_at),
        "last_mail_sync_at": _serialize_datetime(account.last_mail_sync_at),
        "last_error": account.last_error,
        "has_client_id": summary.has_client_id,
        "has_refresh_token": summary.has_refresh_token,
        "token_status": summary.token_status,
        "token_expires_at": _serialize_datetime(summary.token_expires_at),
    }


def _serialize_latest_task(task) -> dict | None:
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


if __name__ == "__main__":
    raise SystemExit(main())
