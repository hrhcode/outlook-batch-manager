from __future__ import annotations

import json
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
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.save(self.defaults)

    def load(self) -> dict[str, Any]:
        return {**self.defaults, **json.loads(self.path.read_text(encoding="utf-8"))}

    def save(self, settings: dict[str, Any]) -> None:
        payload = {**self.defaults, **settings}
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
