# 项目规则

本文档用于统一当前仓库的开发约定，方便跨会话协作时快速对齐规则。

## 1. 项目位置与参考项目

- 主项目根目录：`D:\Project\Me\outlook-batch-manager`
- 参考项目目录：[`D:\Project\Me\outlook-batch-manager\.example`](D:\Project\Me\outlook-batch-manager\.example)
- `.example` 仅用于开发参考，可以阅读和对照实现思路。
- 不允许修改 `.example` 内的内容。
- 不允许将 `.example` 纳入 git 管理。

## 2. 技术架构

- 当前项目采用 `Electron + React 前端` 与 `Python 后端` 的组合架构。
- 前端负责桌面工作台界面、页面交互与 Electron 壳层。
- 后端负责自动化执行、SQLite 数据存储、CLI 接口与业务服务层。

## 3. Git 管理规则

- 本地仓库已初始化 git。
- 远程仓库地址：[`https://github.com/hrhcode/outlook-batch-manager.git`](https://github.com/hrhcode/outlook-batch-manager.git)
- git 用户信息固定为：
  - `user.name = hrhcode`
  - `user.email = hrhzuishuai2022@163.com`
- 以下内容不应纳入版本管理：
  - `.example`
  - 运行日志
  - 本地数据库文件
  - 虚拟环境
  - 缓存目录
  - 构建产物

## 4. 提交规范

- 每完成一部分明确功能后提交一次 git。
- 不把多个无关功能混在同一个提交里。
- `git commit` 必须使用中文。
- 提交信息要求简洁、明确、可读，优先使用动宾结构。
- 提交信息示例：
  - `补齐账号与邮件后端闭环能力`
  - `重构 Electron 五页工作台界面`

## 5. 开发协作规则

- 先讨论方案，方案明确后再开发。
- 开发过程中尽量保持代码干净，避免重复入口、重复页面和废弃实现残留。
- 涉及 UI 时，默认目标是：`精致`、`清晰`、`优雅`、`无冗余信息`。
- 所有用户可见中文文案必须保持正常 UTF-8 编码，禁止乱码。
- 参考项目中的实现思路可以借鉴，但不能直接修改参考项目本身。

## 6. 业务约定

- 项目目标是 Outlook / Hotmail 账号的一站式管理工具。
- 当前重点能力包括：
  - 批量注册
  - 账号管理
  - 联通测试
  - 邮件同步
  - 系统设置
- 账号导入需兼容以下格式：
  - `邮箱----密码`
  - `邮箱----密码----id----令牌`
- 其中：
  - `id` 视为账号专属 `client_id`
  - `令牌` 视为 `refresh_token`

## 7. 启动与验证

- 默认启动命令：

```powershell
Set-Location "D:\Project\Me\outlook-batch-manager"; powershell -ExecutionPolicy Bypass -File .\start.ps1
```

- 每次较大改动后，默认执行以下验证：

```powershell
.\.venv\Scripts\python.exe -m pytest tests
.\.venv\Scripts\python.exe -m compileall src
npm --prefix electron-app run build
Set-Location .\electron-app; npx tsc --noEmit
```

## 8. 文档使用原则

- 后续跨会话协作默认优先遵守本文件。
- 若业务规则发生变化，应优先更新本文件，再继续开发。
