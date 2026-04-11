from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx

from backend.app.core.config import Settings
from backend.app.db.models import Account


class AuthError(RuntimeError):
    pass


@dataclass(slots=True)
class AccessTokenBundle:
    access_token: str
    expires_at: datetime | None
    refreshed: bool = False


@dataclass(slots=True)
class OutlookOAuthService:
    settings: Settings

    async def refresh_access_token(self, account: Account) -> AccessTokenBundle:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                self.settings.token_endpoint,
                data={
                    "grant_type": "refresh_token",
                    "client_id": account.client_id,
                    "refresh_token": account.refresh_token,
                    "scope": self.settings.token_scope
                }
            )

        if response.is_error:
            try:
                payload = response.json()
            except Exception:  # pragma: no cover
                payload = {"error_description": response.text}

            message = payload.get("error_description") or payload.get("error") or "Unknown OAuth error"
            raise AuthError(message)

        payload = response.json()
        access_token = payload.get("access_token")
        if not access_token:
            raise AuthError("Microsoft token response did not include an access token.")

        expires_in = payload.get("expires_in")
        expires_at = None
        if expires_in is not None:
            try:
                expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))
            except (TypeError, ValueError):
                expires_at = None

        return AccessTokenBundle(access_token=access_token, expires_at=expires_at)


def build_xoauth2_string(email: str, access_token: str) -> str:
    payload = f"user={email}\x01auth=Bearer {access_token}\x01\x01"
    return base64.b64encode(payload.encode("utf8")).decode("ascii")
