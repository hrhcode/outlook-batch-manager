from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path
from typing import Iterable

from openpyxl import Workbook, load_workbook

from outlook_batch_manager.models import Account, AccountStatus, AccountSummary, TokenRecord, TokenStatus
from outlook_batch_manager.storage.database import Database


class AccountService:
    def __init__(self, database: Database) -> None:
        self.database = database

    def list_accounts(self, keyword: str = "") -> list[Account]:
        sql = "SELECT * FROM accounts"
        params: tuple[str, ...] = ()
        if keyword:
            sql += " WHERE email LIKE ? OR group_name LIKE ? OR notes LIKE ?"
            term = f"%{keyword}%"
            params = (term, term, term)
        sql += " ORDER BY id DESC"
        with self.database.connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [self._row_to_account(row) for row in rows]

    def list_account_summaries(self, keyword: str = "") -> list[AccountSummary]:
        sql = """
            SELECT
                accounts.*,
                tokens.status AS token_status,
                tokens.expires_at AS token_expires_at
            FROM accounts
            LEFT JOIN tokens ON tokens.account_id = accounts.id
        """
        params: tuple[str, ...] = ()
        if keyword:
            sql += " WHERE accounts.email LIKE ? OR accounts.group_name LIKE ? OR accounts.notes LIKE ?"
            term = f"%{keyword}%"
            params = (term, term, term)
        sql += " ORDER BY accounts.id DESC"
        with self.database.connect() as connection:
            rows = connection.execute(sql, params).fetchall()
        return [
            AccountSummary(
                account=self._row_to_account(row),
                token_status=row["token_status"] or "",
                token_expires_at=datetime.fromisoformat(row["token_expires_at"]) if row["token_expires_at"] else None,
            )
            for row in rows
        ]

    def upsert_account(self, account: Account) -> Account:
        now = account.created_at.isoformat(timespec="seconds") if account.created_at else self.database.now_iso()
        last_login = (
            account.last_login_check_at.isoformat(timespec="seconds")
            if account.last_login_check_at
            else None
        )
        with self.database.connect() as connection:
            existing = connection.execute(
                "SELECT id FROM accounts WHERE email = ?",
                (account.email,),
            ).fetchone()
            if existing:
                connection.execute(
                    """
                    UPDATE accounts
                    SET password = ?, status = ?, source = ?, group_name = ?, notes = ?,
                        recovery_email = ?, last_login_check_at = ?
                    WHERE email = ?
                    """,
                    (
                        account.password,
                        account.status,
                        account.source,
                        account.group_name,
                        account.notes,
                        account.recovery_email,
                        last_login,
                        account.email,
                    ),
                )
                account.id = int(existing["id"])
            else:
                cursor = connection.execute(
                    """
                    INSERT INTO accounts (
                        email, password, status, source, group_name, notes, recovery_email, created_at, last_login_check_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        account.email,
                        account.password,
                        account.status,
                        account.source,
                        account.group_name,
                        account.notes,
                        account.recovery_email,
                        now,
                        last_login,
                    ),
                )
                account.id = int(cursor.lastrowid)
        return account

    def save_token(self, token: TokenRecord) -> TokenRecord:
        expires_at = token.expires_at.isoformat(timespec="seconds") if token.expires_at else None
        refreshed = token.last_refreshed_at.isoformat(timespec="seconds") if token.last_refreshed_at else None
        with self.database.connect() as connection:
            existing = connection.execute(
                "SELECT id FROM tokens WHERE account_id = ?",
                (token.account_id,),
            ).fetchone()
            if existing:
                connection.execute(
                    """
                    UPDATE tokens
                    SET access_token = ?, refresh_token = ?, expires_at = ?, last_refreshed_at = ?, status = ?
                    WHERE account_id = ?
                    """,
                    (
                        token.access_token,
                        token.refresh_token,
                        expires_at,
                        refreshed,
                        token.status,
                        token.account_id,
                    ),
                )
                token.id = int(existing["id"])
            else:
                cursor = connection.execute(
                    """
                    INSERT INTO tokens (account_id, access_token, refresh_token, expires_at, last_refreshed_at, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        token.account_id,
                        token.access_token,
                        token.refresh_token,
                        expires_at,
                        refreshed,
                        token.status,
                    ),
                )
                token.id = int(cursor.lastrowid)
        return token

    def export_accounts(self, destination: Path, accounts: Iterable[Account]) -> None:
        rows = [self._account_to_export_row(account) for account in accounts]
        if destination.suffix.lower() == ".csv":
            with destination.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else self._export_headers())
                writer.writeheader()
                writer.writerows(rows)
            return

        workbook = Workbook()
        worksheet = workbook.active
        headers = self._export_headers()
        worksheet.append(headers)
        for row in rows:
            worksheet.append([row[header] for header in headers])
        workbook.save(destination)

    def import_accounts(self, source: Path, source_name: str = "import") -> int:
        rows: list[dict[str, str]]
        if source.suffix.lower() == ".csv":
            with source.open("r", encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
        else:
            workbook = load_workbook(source, read_only=True)
            worksheet = workbook.active
            values = list(worksheet.iter_rows(values_only=True))
            headers = [str(value).strip() for value in values[0]]
            rows = [dict(zip(headers, ["" if value is None else str(value) for value in row])) for row in values[1:]]

        imported = 0
        for row in rows:
            email = row.get("email", "").strip()
            password = row.get("password", "").strip()
            if not email or not password:
                continue
            account = Account(
                email=email,
                password=password,
                status=AccountStatus(row.get("status", AccountStatus.PENDING)),
                source=source_name,
                group_name=row.get("group_name", "default").strip() or "default",
                notes=row.get("notes", "").strip(),
                recovery_email=row.get("recovery_email", "").strip(),
            )
            self.upsert_account(account)
            imported += 1
        return imported

    @staticmethod
    def _export_headers() -> list[str]:
        return ["email", "password", "status", "source", "group_name", "notes", "recovery_email", "created_at", "last_login_check_at"]

    def _account_to_export_row(self, account: Account) -> dict[str, str]:
        return {
            "email": account.email,
            "password": account.password,
            "status": account.status,
            "source": account.source,
            "group_name": account.group_name,
            "notes": account.notes,
            "recovery_email": account.recovery_email,
            "created_at": account.created_at.isoformat(timespec="seconds") if account.created_at else "",
            "last_login_check_at": account.last_login_check_at.isoformat(timespec="seconds") if account.last_login_check_at else "",
        }

    def _row_to_account(self, row) -> Account:
        return Account(
            id=int(row["id"]),
            email=row["email"],
            password=row["password"],
            status=AccountStatus(row["status"]),
            source=row["source"],
            group_name=row["group_name"],
            notes=row["notes"],
            recovery_email=row["recovery_email"],
            created_at=datetime.fromisoformat(row["created_at"]),
            last_login_check_at=datetime.fromisoformat(row["last_login_check_at"]) if row["last_login_check_at"] else None,
        )
