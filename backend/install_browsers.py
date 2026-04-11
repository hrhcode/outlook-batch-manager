"""
浏览器驱动安装脚本

使用方法：
    python install_browsers.py

可选参数：
    --browser 指定浏览器类型 (patchright 或 playwright)，默认为两者都安装
"""

import argparse
import subprocess
import sys


def install_browser(browser_type: str) -> bool:
    """
    安装指定浏览器驱动

    Args:
        browser_type: 浏览器类型，patchright 或 playwright

    Returns:
        bool: 是否安装成功
    """
    print(f"正在安装 {browser_type} chromium 浏览器...")

    try:
        result = subprocess.run(
            [sys.executable, "-m", browser_type, "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=600
        )

        if result.returncode == 0:
            print(f"✓ {browser_type} chromium 安装成功")
            return True
        else:
            print(f"✗ {browser_type} chromium 安装失败:")
            print(result.stderr)
            return False

    except subprocess.TimeoutExpired:
        print(f"✗ {browser_type} chromium 安装超时")
        return False
    except Exception as e:
        print(f"✗ {browser_type} chromium 安装失败：{e}")
        return False


def check_browser_installed(browser_type: str) -> bool:
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


def main():
    parser = argparse.ArgumentParser(description="安装浏览器驱动")
    parser.add_argument(
        "--browser",
        choices=["patchright", "playwright", "all"],
        default="all",
        help="指定浏览器类型 (默认：两者都安装)"
    )

    args = parser.parse_args()

    browsers = []
    if args.browser == "all":
        browsers = ["patchright", "playwright"]
    else:
        browsers = [args.browser]

    print("=" * 60)
    print("浏览器驱动安装工具")
    print("=" * 60)
    print()

    for browser in browsers:
        installed = check_browser_installed(browser)
        if installed:
            print(f"✓ {browser} chromium 已安装，跳过")
        else:
            install_browser(browser)
        print()

    print("=" * 60)
    print("安装完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
