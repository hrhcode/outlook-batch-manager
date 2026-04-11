from backend.app.services.auth import build_xoauth2_string
from backend.app.services.import_export import parse_account_line, parse_import_blob


def test_parse_import_blob_tracks_valid_rows_and_failures():
    parsed, failures = parse_import_blob(
        "\n".join(
            [
                "first@outlook.com----pass-1----client-a----token-a",
                "broken-row",
                "",
                "second@hotmail.com----pass-2----client-b----token-b",
            ]
        )
    )

    assert [item.email for item in parsed] == ["first@outlook.com", "second@hotmail.com"]
    assert len(failures) == 1
    assert failures[0].line_number == 2


def test_parse_account_line_requires_four_parts():
    try:
        parse_account_line("missing----parts")
    except ValueError as error:
        assert "email----password----client_id----refresh_token" in str(error)
    else:  # pragma: no cover
        raise AssertionError("Expected parse_account_line to fail on an invalid row.")


def test_parse_import_blob_skips_first_header_row_without_credentials():
    parsed, failures = parse_import_blob(
        "\n".join(
            [
                "卡号",
                "first@outlook.com----pass-1----client-a----token-a",
            ]
        )
    )

    assert [item.email for item in parsed] == ["first@outlook.com"]
    assert failures == []


def test_build_xoauth2_string_contains_email_and_token():
    encoded = build_xoauth2_string("user@outlook.com", "access-token")

    assert encoded
    assert "user@outlook.com" not in encoded
