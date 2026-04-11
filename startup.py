"""
统一启动脚本 - 智能检测依赖并启动项目

功能：
1. 检查 Python 依赖是否安装
2. 检查浏览器驱动是否安装
3. 按需安装缺失的依赖
4. 启动后端服务

使用方法：
    python startup.py
"""

import subprocess
import sys
import os
import importlib.util

# 添加项目根目录到路径
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, ROOT_DIR)


def print_header(text):
    """打印标题"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")


def print_success(text):
    """打印成功消息"""
    print(f"✓ {text}")


def print_info(text):
    """打印提示信息"""
    print(f"ℹ {text}")


def print_error(text):
    """打印错误消息"""
    print(f"✗ {text}")


def check_python_dependencies():
    """
    检查 Python 依赖是否已安装

    Returns:
        bool: 是否需要安装依赖
    """
    print_header("检查 Python 依赖")

    required_packages = [
        "fastapi",
        "uvicorn",
        "sqlalchemy",
        "pydantic",
        "httpx",
        "faker",
        "playwright",
        "patchright"
    ]

    missing = []
    for package in required_packages:
        spec = importlib.util.find_spec(package)
        if spec is None:
            missing.append(package)
            print_error(f"未安装：{package}")
        else:
            print_success(f"已安装：{package}")

    if missing:
        print_info(f"需要安装的依赖：{', '.join(missing)}")
        return True
    else:
        print_success("所有 Python 依赖已安装")
        return False


def install_python_dependencies():
    """
    安装 Python 依赖

    Returns:
        bool: 是否安装成功
    """
    print_header("安装 Python 依赖")

    requirements_file = os.path.join(BACKEND_DIR, "requirements.txt")

    if not os.path.exists(requirements_file):
        print_error(f"未找到依赖文件：{requirements_file}")
        return False

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", requirements_file],
            cwd=BACKEND_DIR,
            capture_output=False
        )

        if result.returncode == 0:
            print_success("Python 依赖安装成功")
            return True
        else:
            print_error("Python 依赖安装失败")
            return False

    except Exception as e:
        print_error(f"安装失败：{e}")
        return False


def check_browser_drivers():
    """
    检查浏览器驱动是否已安装

    Returns:
        bool: 是否需要安装浏览器驱动
    """
    print_header("检查浏览器驱动")

    needs_install = False

    # 检查 patchright
    try:
        from patchright.sync_api import sync_playwright
        p = sync_playwright().start()
        try:
            p.chromium.executable_path
            p.stop()
            print_success("patchright chromium 已安装")
        except Exception:
            p.stop()
            print_error("patchright chromium 未安装")
            needs_install = True
    except Exception as e:
        print_error(f"patchright 未安装：{e}")
        needs_install = True

    # 检查 playwright
    try:
        from playwright.sync_api import sync_playwright
        p = sync_playwright().start()
        try:
            p.chromium.executable_path
            p.stop()
            print_success("playwright chromium 已安装")
        except Exception:
            p.stop()
            print_error("playwright chromium 未安装")
            needs_install = True
    except Exception as e:
        print_error(f"playwright 未安装：{e}")
        needs_install = True

    return needs_install


def install_browser_drivers():
    """
    安装浏览器驱动

    Returns:
        bool: 是否安装成功
    """
    print_header("安装浏览器驱动")
    print_info("这可能需要几分钟，请耐心等待...\n")

    browsers = ["patchright", "playwright"]

    for browser in browsers:
        print_info(f"正在安装 {browser} chromium...")
        try:
            result = subprocess.run(
                [sys.executable, "-m", browser, "install", "chromium"],
                capture_output=False,
                timeout=600
            )

            if result.returncode == 0:
                print_success(f"{browser} chromium 安装成功")
            else:
                print_error(f"{browser} chromium 安装失败")
        except subprocess.TimeoutExpired:
            print_error(f"{browser} chromium 安装超时")
        except Exception as e:
            print_error(f"{browser} chromium 安装失败：{e}")

    print_success("浏览器驱动安装完成")
    return True


def start_all_services():
    """
    启动所有服务（后端、UI、Desktop）
    """
    print_header("启动所有服务")
    print_info("正在启动后端、UI 和 Desktop 应用...\n")

    import socket
    import subprocess
    import threading

    # 查找可用端口
    def find_open_port(start_port=8765):
        for port in range(start_port, start_port + 100):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("127.0.0.1", port))
                    return port
            except OSError:
                continue
        return start_port

    backend_port = find_open_port()
    print_info(f"使用端口：{backend_port}")

    # 启动后端
    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = ROOT_DIR
    backend_env["CORE_GATEWAY_PORT"] = str(backend_port)

    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", str(backend_port)],
        cwd=BACKEND_DIR,
        env=backend_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
    )

    # 启动 UI
    print_info("启动 UI 开发服务器...")
    ui_process = subprocess.Popen(
        ["npm", "run", "dev:ui"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=True,
        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
    )

    # 等待 UI 启动
    import time
    time.sleep(5)

    # 启动 Desktop
    print_info("启动 Desktop 应用...")
    desktop_env = os.environ.copy()
    desktop_env["VITE_DEV_SERVER_URL"] = f"http://127.0.0.1:5173"
    
    desktop_process = subprocess.Popen(
        ["npm", "run", "dev:desktop"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=True,
        env=desktop_env,
        creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
    )

    # 监控进程输出
    def monitor_process(process, name):
        try:
            for line in process.stdout:
                print(f"[{name}] {line}", end="")
        except Exception:
            pass

    # 启动监控线程
    threading.Thread(target=monitor_process, args=(backend_process, "Backend"), daemon=True).start()
    threading.Thread(target=monitor_process, args=(ui_process, "UI"), daemon=True).start()
    threading.Thread(target=monitor_process, args=(desktop_process, "Desktop"), daemon=True).start()

    # 等待进程结束
    try:
        backend_process.wait()
        ui_process.wait()
        desktop_process.wait()
    except KeyboardInterrupt:
        print_info("\n正在停止所有服务...")
        backend_process.terminate()
        ui_process.terminate()
        desktop_process.terminate()
        print_info("所有服务已停止")


def main():
    """
    主函数
    """
    print_header("Core Gateway 启动脚本")

    # 1. 检查并安装 Python 依赖
    if check_python_dependencies():
        if not install_python_dependencies():
            print_error("\nPython 依赖安装失败，无法启动")
            sys.exit(1)

    # 2. 检查并安装浏览器驱动
    if check_browser_drivers():
        if not install_browser_drivers():
            print_error("\n浏览器驱动安装失败，但可以尝试启动")

    # 3. 启动所有服务
    start_all_services()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n启动已取消")
        sys.exit(0)
    except Exception as e:
        print_error(f"\n启动失败：{e}")
        sys.exit(1)
