from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RegisterConfig(BaseModel):
    """
    注册配置
    """
    browser: str = "patchright"
    concurrent_flows: int = 5
    max_tasks: int = 10
    bot_protection_wait: int = 11
    max_captcha_retries: int = 2
    enable_oauth2: bool = False


class RegisterTaskCreate(BaseModel):
    """
    创建注册任务请求
    """
    config: RegisterConfig


class RegisterTaskStatus(BaseModel):
    """
    注册任务状态
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    total_count: int
    succeeded_count: int
    failed_count: int
    created_at: datetime
    completed_at: datetime | None


class RegisterProgress(BaseModel):
    """
    注册进度
    """
    task_id: int
    current: int
    total: int
    succeeded: int
    failed: int
    latest_email: str | None
    latest_status: str
    message: str
