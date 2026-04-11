from __future__ import annotations

from dataclasses import dataclass

from backend.app.schemas.accounts import ImportFailure


@dataclass(slots=True)
class ParsedAccountLine:
    email: str
    password: str
    client_id: str
    refresh_token: str


def parse_account_line(raw: str) -> ParsedAccountLine:
    parts = [part.strip() for part in raw.split("----")]
    if len(parts) != 4 or any(part == "" for part in parts):
        raise ValueError("Account rows must use email----password----client_id----refresh_token.")

    email = parts[0].lower()
    if "@" not in email:
        raise ValueError("Email address is invalid.")

    return ParsedAccountLine(
        email=email,
        password=parts[1],
        client_id=parts[2],
        refresh_token=parts[3]
    )


def parse_import_blob(content: str) -> tuple[list[ParsedAccountLine], list[ImportFailure]]:
    parsed: list[ParsedAccountLine] = []
    failures: list[ImportFailure] = []
    first_non_empty_seen = False

    for line_number, line in enumerate(content.splitlines(), start=1):
        raw = line.strip()
        if not raw:
            continue

        if not first_non_empty_seen:
            first_non_empty_seen = True
            if "----" not in raw:
                continue

        try:
            parsed.append(parse_account_line(raw))
        except ValueError as error:
            failures.append(
                ImportFailure(
                    line_number=line_number,
                    raw=line,
                    reason=str(error)
                )
            )

    return parsed, failures


def export_account_rows(rows: list[tuple[str, str, str, str]]) -> str:
    return "\n".join("----".join(row) for row in rows)


def decode_import_bytes(payload: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue

    return payload.decode("utf-8", errors="replace")
