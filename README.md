<div align="center">

# 📧 Outlook Batch Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Electron](https://img.shields.io/badge/Electron-31+-9feaf9.svg)](https://www.electronjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://react.dev/)

**Windows 桌面应用，用于批量管理 Outlook 和 Hotmail 邮箱账号**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [项目结构](#-项目结构) • [开发指南](#-开发指南) • [API文档](#-api文档)

</div>

---

## ✨ 功能特性

- 📋 **账号管理** - 批量导入/导出邮箱账号，支持 CSV 和 Excel 格式
- 📨 **邮件同步** - 通过 IMAP 协议自动同步邮件
- 📝 **批量注册** - 自动化批量注册 Outlook/Hotmail 账号
- 🔒 **代理支持** - 支持 HTTP/SOCKS5 代理池管理
- 🔐 **OAuth2 认证** - 支持 Microsoft OAuth2 授权登录
- 🔔 **实时通知** - 基于 EventSource 的实时任务进度推送

## 🚀 快速开始

### 环境要求

| 依赖     | 版本要求      |
| -------- | ------------- |
| Node.js  | >= 20.0.0     |
| Python   | >= 3.11       |
| 操作系统 | Windows 10/11 |

### 安装

```bash
# 1. 克隆仓库
git clone <repository-url>
cd outlook-batch-manager

# 2. 安装 Node.js 依赖
npm install

# 3. 安装 Python 依赖
python -m pip install -r backend/requirements.txt

# 4. 安装浏览器（用于自动化注册）
cd backend
python install_browsers.py
```

### 运行

```bash
# 开发模式（同时启动前端、后端和 Electron）
npm run dev

# 仅启动前端 UI
npm run dev:ui

# 仅启动桌面应用
npm run dev:desktop
```

### 构建

```bash
npm run build
```

构建输出位于 `desktop/release/` 目录。

## 📁 项目结构

```
outlook-batch-manager/
├── 📂 backend/              # FastAPI 后端服务
│   ├── 📂 app/
│   │   ├── 📂 api/          # REST API 路由
│   │   ├── 📂 core/         # 核心配置
│   │   ├── 📂 db/           # 数据库模型和操作
│   │   ├── 📂 schemas/      # Pydantic 数据模型
│   │   └── 📂 services/     # 业务逻辑服务
│   │       └── 📂 browser/  # 浏览器自动化控制
│   └── 📂 tests/            # 后端测试
├── 📂 desktop/              # Electron 桌面应用壳
├── 📂 ui/                   # React + Vite 前端界面
└── 📂 .trae/documents/      # 项目文档
```

### 后端架构

| 目录/文件                                                | 说明                                                     |
| -------------------------------------------------------- | -------------------------------------------------------- |
| [`app/api/`](backend/app/api/)                           | REST API 路由定义，包括账号、邮件、代理、注册等接口      |
| [`app/core/config.py`](backend/app/core/config.py)       | 应用配置管理                                             |
| [`app/db/`](backend/app/db/)                             | SQLAlchemy 数据库模型和初始化                            |
| [`app/schemas/`](backend/app/schemas/)                   | Pydantic 数据验证模型                                    |
| [`app/services/`](backend/app/services/)                 | 核心业务逻辑，包括 IMAP 同步、OAuth 认证、浏览器自动化等 |
| [`app/services/browser/`](backend/app/services/browser/) | Playwright/Patchright 浏览器控制器                       |

### 前端架构

| 目录                                        | 说明                                   |
| ------------------------------------------- | -------------------------------------- |
| [`src/components/`](ui/src/components/)     | React 组件，包括表单、面板、状态显示等 |
| [`src/pages/`](ui/src/pages/)               | 页面组件（账号列表、邮件、注册页面等） |
| [`src/api/client.ts`](ui/src/api/client.ts) | API 客户端封装                         |
| [`src/hooks/`](ui/src/hooks/)               | 自定义 React Hooks                     |
| [`src/styles/`](ui/src/styles/)             | CSS 样式文件                           |

### 桌面端架构

| 文件                                               | 说明                            |
| -------------------------------------------------- | ------------------------------- |
| [`main.js`](desktop/main.js)                       | Electron 主进程入口             |
| [`preload.js`](desktop/preload.js)                 | 预加载脚本，提供安全的 IPC 通信 |
| [`backend-manager.js`](desktop/backend-manager.js) | 后端服务管理器                  |

## 🛠️ 开发指南

### 可用脚本

```bash
# 运行测试
npm test

# 前端类型检查
npm run typecheck

# 桌面端测试
npm run lint
```

### 技术栈

#### 后端

- **[FastAPI](https://fastapi.tiangolo.com/)** - 高性能 Web 框架
- **[SQLAlchemy](https://www.sqlalchemy.org/)** - ORM 数据库操作
- **[Playwright](https://playwright.dev/python/)** / **Patchright** - 浏览器自动化
- **[imapclient](https://imapclient.readthedocs.io/)** - IMAP 邮件同步
- **[Pydantic](https://docs.pydantic.dev/)** - 数据验证

#### 前端

- **[React 18](https://react.dev/)** - UI 框架
- **[React Router](https://reactrouter.com/)** - 路由管理
- **[TanStack Query](https://tanstack.com/query)** - 数据获取和缓存
- **[Vite](https://vitejs.dev/)** - 构建工具
- **[Vitest](https://vitest.dev/)** - 测试框架

#### 桌面端

- **[Electron](https://www.electronjs.org/)** - 桌面应用框架

## 📚 API 文档

启动后端服务后，访问以下地址查看 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

---

<div align="center">

**[⬆ 回到顶部](#-outlook-batch-manager)**

</div>
