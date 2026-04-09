# Outlook Batch Manager

Outlook / Hotmail 账号批量注册、登录校验、Token 管理与账号库整理的 Windows 桌面工具。

## 当前阶段

- `Python + PySide6` 桌面应用
- `SQLite` 本地数据存储
- `Playwright` 自动化驱动抽象
- 任务中心支持批量注册、登录校验、Token 刷新
- 账号库支持 CSV / Excel 导入导出

## 快速开始

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .[dev]
playwright install chromium
python main.py
```

## 目录结构

- `src/outlook_batch_manager/` 应用源码
- `tests/` 测试
- `.example/` 参考项目，只读，不纳入版本管理

