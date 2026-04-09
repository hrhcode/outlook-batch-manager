from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


class SettingsService:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.defaults = {
            "browser_channel": "chromium",
            "browser_executable_path": "",
            "headless": False,
            "timeout_ms": 30000,
            "captcha_wait_ms": 12000,
            "user_agent": "",
            "use_mock_driver": True,
            "client_id": "",
            "redirect_url": "",
            "scopes": [],
            "mail_sync": {
                "default_source": "auto",
                "batch_limit": 20,
                "unread_only": False,
                "graph_fallback_to_imap": True,
            },
            "mail_protocols": {
                "imap": {
                    "enabled": False,
                    "host": "outlook.office365.com",
                    "port": 993,
                    "use_ssl": True,
                },
                "pop": {
                    "enabled": False,
                    "host": "outlook.office365.com",
                    "port": 995,
                    "use_ssl": True,
                },
            },
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.save(self.defaults)

    def load(self) -> dict[str, Any]:
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        return self._deep_merge(deepcopy(self.defaults), raw)

    def save(self, settings: dict[str, Any]) -> None:
        payload = self._deep_merge(deepcopy(self.defaults), settings)
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _deep_merge(self, base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
        for key, value in override.items():
            if isinstance(value, dict) and isinstance(base.get(key), dict):
                base[key] = self._deep_merge(dict(base[key]), value)
            else:
                base[key] = value
        return base
