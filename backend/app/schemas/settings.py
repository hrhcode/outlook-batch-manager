from __future__ import annotations

from pydantic import BaseModel


class OAuth2Settings(BaseModel):
    """
    OAuth2设置
    """
    client_id: str
    redirect_url: str
    scopes: list[str]


class AppSettingsResponse(BaseModel):
    """
    应用设置响应
    """
    oauth2: OAuth2Settings
