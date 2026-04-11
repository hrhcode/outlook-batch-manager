from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.database import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    domain: Mapped[str] = mapped_column(String(255), index=True)
    password: Mapped[str] = mapped_column(Text)
    client_id: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    account_status: Mapped[str] = mapped_column(String(24), default="disconnected", index=True)
    last_test_status: Mapped[str] = mapped_column(String(24), default="untested", index=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    mailbox_state: Mapped["MailboxState"] = relationship(back_populates="account", uselist=False, cascade="all, delete-orphan")
    messages: Mapped[list["MailMessage"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class MailboxState(Base):
    __tablename__ = "mailbox_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), unique=True)
    folder: Mapped[str] = mapped_column(String(128), default="INBOX")
    uidvalidity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_uid: Mapped[int] = mapped_column(Integer, default=0)
    idle_supported: Mapped[bool] = mapped_column(Boolean, default=True)
    fallback_mode: Mapped[str] = mapped_column(String(24), default="idle")
    backoff_seconds: Mapped[int] = mapped_column(Integer, default=0)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_idle_restart_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    account: Mapped[Account] = relationship(back_populates="mailbox_state")


class MailMessage(Base):
    __tablename__ = "mail_messages"
    __table_args__ = (
        UniqueConstraint("account_id", "folder", "uidvalidity", "uid", name="uq_message_identity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    folder: Mapped[str] = mapped_column(String(128), default="INBOX")
    uidvalidity: Mapped[str] = mapped_column(String(64))
    uid: Mapped[int] = mapped_column(Integer)
    message_id: Mapped[str | None] = mapped_column(String(512), nullable=True)
    subject: Mapped[str] = mapped_column(Text, default="")
    sender: Mapped[str] = mapped_column(Text, default="")
    from_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipients: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str] = mapped_column(Text, default="")
    body_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    body_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_unread: Mapped[bool] = mapped_column(Boolean, default=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    account: Mapped[Account] = relationship(back_populates="messages")


class RegisterTask(Base):
    """
    注册任务记录
    """
    __tablename__ = "register_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    total_count: Mapped[int] = mapped_column(Integer)
    succeeded_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    config: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ProxyPool(Base):
    """
    代理池
    """
    __tablename__ = "proxy_pool"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proxy_url: Mapped[str] = mapped_column(String(512))
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    fail_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppSettings(Base):
    """
    应用设置
    """
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    oauth2_client_id: Mapped[str] = mapped_column(Text, default="")
    oauth2_redirect_url: Mapped[str] = mapped_column(Text, default="")
    oauth2_scopes: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
