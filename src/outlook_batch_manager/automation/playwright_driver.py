from __future__ import annotations

import base64
import hashlib
import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote

import requests
from playwright.sync_api import sync_playwright

from outlook_batch_manager.automation.base import AutomationDriver, AutomationResult, RegistrationPayload
from outlook_batch_manager.models import Account, AccountStatus


@dataclass(slots=True)
class PlaywrightOptions:
    executable_path: str = ""
    headless: bool = False
    timeout_ms: int = 30000
    captcha_wait_ms: int = 12000
    user_agent: str = ""
    client_id: str = ""
    redirect_url: str = ""
    scopes: list[str] | None = None


class PlaywrightAutomationDriver(AutomationDriver):
    def __init__(self, options: PlaywrightOptions) -> None:
        self.options = options

    def register(self, payload: RegistrationPayload, proxy: str | None = None) -> AutomationResult:
        with self._open_session(proxy) as page:
            page.goto("https://outlook.live.com/mail/0/?prompt=create_account", wait_until="domcontentloaded")
            self._click_if_exists(page, "同意并继续")
            page.locator('input[type="email"], [aria-label="新建电子邮件"]').first.fill(payload.email)
            self._click_primary(page)
            page.locator('input[type="password"]').first.fill(payload.password)
            self._click_primary(page)
            self._fill_identity(page, payload)
            ok = self._wait_for_mail_shell(page)
            account = Account(
                email=f"{payload.email}@outlook.com" if "@outlook.com" not in payload.email else payload.email,
                password=payload.password,
                status=AccountStatus.PENDING,
                source="register_task",
            )
            return AutomationResult(success=ok, message="注册成功" if ok else "注册后未进入邮箱初始化界面", account=account if ok else None)

    def verify_login(self, email: str, password: str, proxy: str | None = None) -> AutomationResult:
        with self._open_session(proxy) as page:
            page.goto("https://login.live.com/", wait_until="domcontentloaded")
            page.locator('input[type="email"], [name="loginfmt"]').first.fill(email)
            self._click_primary(page)
            page.locator('input[type="password"]').first.fill(password)
            self._click_primary(page)
            self._click_if_exists(page, "否")
            page.wait_for_timeout(3000)
            ok = page.locator('text=Inbox, text=Outlook, text=收件箱').count() > 0
            return AutomationResult(success=ok, message="登录校验成功" if ok else "登录校验失败")

    def refresh_token(
        self,
        email: str,
        password: str,
        proxy: str | None = None,
        refresh_token: str = "",
    ) -> AutomationResult:
        if refresh_token and self.options.client_id and self.options.redirect_url:
            response = requests.post(
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                data={
                    "client_id": self.options.client_id,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                    "redirect_uri": self.options.redirect_url,
                    "scope": " ".join(self.options.scopes or []),
                },
                timeout=30,
            )
            payload = response.json()
            if "refresh_token" in payload:
                return AutomationResult(
                    success=True,
                    message="Token 刷新成功",
                    access_token=payload.get("access_token", ""),
                    refresh_token=payload.get("refresh_token", refresh_token),
                    expires_at=datetime.now() + timedelta(seconds=int(payload.get("expires_in", 3600))),
                )
        return self._authorize_token(email, password, proxy)

    def _authorize_token(self, email: str, password: str, proxy: str | None) -> AutomationResult:
        if not self.options.client_id or not self.options.redirect_url:
            return AutomationResult(success=False, message="未配置 Azure OAuth 参数")
        verifier = self._generate_code_verifier()
        params = {
            "client_id": self.options.client_id,
            "response_type": "code",
            "redirect_uri": self.options.redirect_url,
            "scope": " ".join(self.options.scopes or []),
            "response_mode": "query",
            "prompt": "select_account",
            "code_challenge": self._generate_code_challenge(verifier),
            "code_challenge_method": "S256",
        }
        auth_url = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + "&".join(
            f"{key}={quote(value)}" for key, value in params.items()
        )
        with self._open_session(proxy) as page:
            with page.expect_response(lambda response: self.options.redirect_url in response.url, timeout=self.options.timeout_ms) as callback:
                page.goto(auth_url, wait_until="domcontentloaded")
                page.locator('[name="loginfmt"]').first.fill(email)
                self._click_primary(page)
                page.locator('input[type="password"]').first.fill(password)
                self._click_primary(page)
                self._click_if_exists(page, "接受")
                self._click_if_exists(page, "同意")
            callback_url = callback.value.url
        if "code=" not in callback_url:
            return AutomationResult(success=False, message="OAuth 回调中未拿到 code")
        auth_code = callback_url.split("code=")[1].split("&")[0]
        response = requests.post(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            data={
                "client_id": self.options.client_id,
                "code": auth_code,
                "redirect_uri": self.options.redirect_url,
                "grant_type": "authorization_code",
                "code_verifier": verifier,
                "scope": " ".join(self.options.scopes or []),
            },
            timeout=30,
        )
        payload = response.json()
        if "refresh_token" not in payload:
            return AutomationResult(success=False, message=f"Token 获取失败: {payload}")
        return AutomationResult(
            success=True,
            message="Token 获取成功",
            access_token=payload.get("access_token", ""),
            refresh_token=payload.get("refresh_token", ""),
            expires_at=datetime.now() + timedelta(seconds=int(payload.get("expires_in", 3600))),
        )

    def _fill_identity(self, page, payload: RegistrationPayload) -> None:
        for selector, value in (
            ('#lastNameInput', payload.last_name),
            ('#firstNameInput', payload.first_name),
            ('[name="BirthYear"]', str(payload.birth_year)),
        ):
            try:
                page.locator(selector).first.fill(value)
            except Exception:
                pass
        for selector, value in (('[name="BirthMonth"]', str(payload.birth_month)), ('[name="BirthDay"]', str(payload.birth_day))):
            try:
                page.locator(selector).first.select_option(value=value)
            except Exception:
                pass
        self._click_primary(page)
        page.wait_for_timeout(self.options.captcha_wait_ms)

    def _wait_for_mail_shell(self, page) -> bool:
        try:
            page.wait_for_load_state("networkidle", timeout=self.options.timeout_ms)
        except Exception:
            pass
        return page.locator('text=Outlook, text=Inbox, text=收件箱, [aria-label="新邮件"]').count() > 0

    def _click_primary(self, page) -> None:
        for selector in ('[data-testid="primaryButton"]', '#idSIButton9', 'button[type="submit"]'):
            try:
                page.locator(selector).first.click(timeout=3000)
                return
            except Exception:
                continue
        raise RuntimeError("未找到下一步按钮")

    def _click_if_exists(self, page, text: str) -> None:
        try:
            page.get_by_text(text, exact=False).first.click(timeout=3000)
        except Exception:
            pass

    def _generate_code_verifier(self, length: int = 128) -> str:
        alphabet = string.ascii_letters + string.digits + "-._~"
        return "".join(secrets.choice(alphabet) for _ in range(length))

    def _generate_code_challenge(self, code_verifier: str) -> str:
        digest = hashlib.sha256(code_verifier.encode()).digest()
        return base64.urlsafe_b64encode(digest).decode().rstrip("=")

    def _open_session(self, proxy: str | None):
        options = self.options

        class Session:
            def __enter__(self_inner):
                self_inner.playwright = sync_playwright().start()
                launch_options: dict[str, Any] = {"headless": options.headless}
                if options.executable_path:
                    launch_options["executable_path"] = options.executable_path
                if proxy:
                    launch_options["proxy"] = {"server": proxy, "bypass": "localhost"}
                self_inner.browser = self_inner.playwright.chromium.launch(**launch_options)
                context_options: dict[str, Any] = {"locale": "zh-CN"}
                if options.user_agent:
                    context_options["user_agent"] = options.user_agent
                self_inner.context = self_inner.browser.new_context(**context_options)
                self_inner.page = self_inner.context.new_page()
                self_inner.page.set_default_timeout(options.timeout_ms)
                return self_inner.page

            def __exit__(self_inner, exc_type, exc_val, exc_tb):
                try:
                    self_inner.context.close()
                except Exception:
                    pass
                try:
                    self_inner.browser.close()
                except Exception:
                    pass
                try:
                    self_inner.playwright.stop()
                except Exception:
                    pass

        return Session()
