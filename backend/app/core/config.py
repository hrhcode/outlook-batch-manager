from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


@dataclass(slots=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 8765
    desktop_token: str = "dev-token"
    data_dir: Path = Path.home() / ".core-gateway"
    token_endpoint: str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
    token_scope: str = "https://outlook.office.com/IMAP.AccessAsUser.All offline_access"
    imap_host: str = "outlook.office365.com"
    imap_port: int = 993
    initial_fetch_limit: int = 50
    idle_timeout_seconds: int = 1500
    fallback_poll_seconds: int = 120
    token_refresh_leeway_seconds: int = 300
    backoff_schedule: tuple[int, ...] = (30, 60, 120, 300, 600)

    register_browser: str = "patchright"
    register_bot_wait: int = 11
    register_max_captcha_retries: int = 2
    oauth2_client_id: str = ""
    oauth2_redirect_url: str = ""
    oauth2_scopes: list[str] = field(default_factory=lambda: [
        "offline_access",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",
        "https://graph.microsoft.com/User.Read"
    ])

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'core_gateway.sqlite3'}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    data_dir = Path(os.getenv("CORE_GATEWAY_DATA_DIR", Path.home() / ".core-gateway"))
    data_dir.mkdir(parents=True, exist_ok=True)

    return Settings(
        host=os.getenv("CORE_GATEWAY_HOST", "127.0.0.1"),
        port=int(os.getenv("CORE_GATEWAY_PORT", "8765")),
        desktop_token=os.getenv("CORE_GATEWAY_TOKEN", "dev-token"),
        data_dir=data_dir
    )
