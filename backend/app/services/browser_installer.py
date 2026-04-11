import asyncio
import subprocess
import sys
from pathlib import Path


async def ensure_browser_installed(browser_type: str = "patchright") -> bool:
    """
    确保浏览器驱动已安装

    Args:
        browser_type: 浏览器类型，patchright 或 playwright

    Returns:
        bool: 是否安装成功
    """
    try:
        if browser_type == "patchright":
            result = subprocess.run(
                [sys.executable, "-m", "patchright", "install", "chromium"],
                capture_output=True,
                text=True,
                timeout=300
            )
            return result.returncode == 0
        else:
            result = subprocess.run(
                [sys.executable, "-m", "playwright", "install", "chromium"],
                capture_output=True,
                text=True,
                timeout=300
            )
            return result.returncode == 0
    except subprocess.TimeoutExpired:
        return False
    except Exception:
        return False


async def check_browser_installed(browser_type: str = "patchright") -> bool:
    """
    检查浏览器驱动是否已安装

    Args:
        browser_type: 浏览器类型

    Returns:
        bool: 是否已安装
    """
    try:
        if browser_type == "patchright":
            from patchright.sync_api import sync_playwright
            p = sync_playwright().start()
            try:
                p.chromium.executable_path
                p.stop()
                return True
            except Exception:
                p.stop()
                return False
        else:
            from playwright.sync_api import sync_playwright
            p = sync_playwright().start()
            try:
                p.chromium.executable_path
                p.stop()
                return True
            except Exception:
                p.stop()
                return False
    except ImportError:
        return False
    except Exception:
        return False


async def install_browsers_on_startup():
    """
    应用启动时安装浏览器驱动
    """
    browsers = ["patchright", "playwright"]

    for browser in browsers:
        installed = await check_browser_installed(browser)
        if not installed:
            success = await ensure_browser_installed(browser)
            if success:
                print(f"[Browser Installer] {browser} chromium installed successfully")
            else:
                print(f"[Browser Installer] Failed to install {browser} chromium")
        else:
            print(f"[Browser Installer] {browser} chromium already installed")
