from pathlib import Path

from outlook_batch_manager.bootstrap import bootstrap_services
from outlook_batch_manager.models import ConnectivityStatus, MailCapabilityStatus


def test_default_settings_use_imap_oauth_defaults(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)

    settings = services.settings.load()

    assert settings["mock_mode"] is False
    assert settings["oauth"]["scopes"] == [
        "offline_access",
        "https://outlook.office.com/IMAP.AccessAsUser.All",
    ]
    assert settings["mail_protocols"]["imap"]["enabled"] is True
    assert settings["mail"]["poll_interval_minutes"] == 1


def test_legacy_mock_driver_setting_maps_to_mock_mode(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    services.settings.save({"use_mock_driver": True})

    settings = services.settings.load()

    assert settings["mock_mode"] is True
    assert settings["use_mock_driver"] is True


def test_create_auth_session_requires_known_account(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    created = services.accounts.create_account(
        email="auth@example.com",
        password="Password123!",
        client_id_override="client-123",
    )

    payload = services.mail.create_auth_session(created.id or 0)

    assert payload["session_id"]
    assert payload["state"]
    assert "login.microsoftonline.com/consumers/oauth2/v2.0/authorize" in payload["authorization_url"]


def test_mock_sync_uses_messages_table(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    settings = services.settings.load()
    settings["mock_mode"] = True
    services.settings.save(settings)
    account = services.accounts.create_account(email="demo@outlook.com", password="Password123!")

    outcome = services.mail.sync_account(account.id or 0, limit=3)
    messages = services.mail.list_messages(account_id=account.id)

    assert outcome.success is True
    assert outcome.message_count == 3
    assert len(messages) == 3
    assert messages[0]["source"] == "mock"


def test_imported_refresh_token_requests_outlook_default_scope(tmp_path: Path, monkeypatch) -> None:
    services = bootstrap_services(tmp_path)
    account = services.accounts.create_account(
        email="imap@example.com",
        password="Password123!",
        client_id_override="client-imap",
        refresh_token="refresh-imap",
    )
    token = services.accounts.get_token(account.id or 0)
    captured: dict[str, str] = {}

    class DummyResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, str]:
            return {
                "access_token": "access-imap",
                "refresh_token": "refresh-imap-2",
                "expires_in": 3600,
            }

    def fake_post(url: str, data: dict[str, str], timeout: int):
        captured.update(data)
        return DummyResponse()

    monkeypatch.setattr("outlook_batch_manager.services.mail_service.requests.post", fake_post)

    access_token = services.mail._ensure_access_token(account, token)

    assert access_token == "access-imap"
    assert captured["scope"] == "https://outlook.office.com/.default"


def test_sync_due_accounts_only_polls_connected_accounts(tmp_path: Path) -> None:
    services = bootstrap_services(tmp_path)
    settings = services.settings.load()
    settings["mock_mode"] = True
    settings["mail"]["poll_interval_minutes"] = 1
    services.settings.save(settings)

    connected = services.accounts.create_account(
        email="connected@outlook.com",
        password="Password123!",
    )
    blocked = services.accounts.create_account(
        email="blocked@outlook.com",
        password="Password123!",
    )
    services.accounts.update_account_runtime(
        connected.id or 0,
        connectivity_status=ConnectivityStatus.CONNECTED,
        mail_capability_status=MailCapabilityStatus.RECEIVE_ONLY,
    )

    result = services.mail.sync_due_accounts()

    assert result["scheduled"] == 1
    assert result["success"] == 1
    connected_messages = services.mail.list_messages(account_id=connected.id)
    blocked_messages = services.mail.list_messages(account_id=blocked.id)
    assert len(connected_messages) > 0
    assert blocked_messages == []


def test_decode_bytes_handles_common_chinese_mail_charsets(tmp_path: Path) -> None:
    text = "测试邮件"
    encoded = text.encode("gb18030")
    services = bootstrap_services(tmp_path)

    decoded = services.mail._decode_bytes(encoded, "gb18030")

    assert decoded == text
