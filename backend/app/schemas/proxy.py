from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProxyCreate(BaseModel):
    """
    创建代理请求
    """
    proxy_url: str


class ProxyUpdate(BaseModel):
    """
    更新代理请求
    """
    is_enabled: bool | None = None


class ProxyItem(BaseModel):
    """
    代理项
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    proxy_url: str
    is_enabled: bool
    last_used_at: datetime | None
    success_count: int
    fail_count: int
