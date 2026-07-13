<div align="center">

# Craft Pass

**面向 Minecraft 服务器的入服审核、答题与 RCON 白名单管理系统**

[![CI](https://github.com/finkkk/craft-pass/actions/workflows/ci.yml/badge.svg)](https://github.com/finkkk/craft-pass/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/finkkk/craft-pass?style=flat-square&logo=github)](https://github.com/finkkk/craft-pass/stargazers)
[![GitHub release](https://img.shields.io/github/v/release/finkkk/craft-pass?display_name=tag&style=flat-square)](https://github.com/finkkk/craft-pass/releases)
[![License](https://img.shields.io/github/license/finkkk/craft-pass?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12.0-339933?style=flat-square&logo=node.js&logoColor=white)](.nvmrc)
[![Docker](https://img.shields.io/badge/Docker_Compose-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](compose.yaml)

[功能](#主要功能) · [Docker 部署](#方式一docker-compose-部署推荐) · [Windows 本机运行](#方式二windows-本机运行) · [Ubuntu Nodejs 部署](#方式三ubuntu-直接运行-nodejs) · [使用教程](#首次初始化与日常使用) · [故障排查](#常见问题)

</div>

Craft Pass 为 Minecraft 社区提供完整的玩家准入流程：玩家填写身份、阅读服规、签署协议并答题；通过后由管理员审核，并可通过 RCON 自动加入服务器白名单。

> [!IMPORTANT]
> 生产环境推荐使用 Docker Compose。它会固定 Node.js 版本、自动迁移数据库、持久化数据，并通过 Caddy 提供反向代理和 HTTPS。

## 主要功能

- 玩家资料填写、服规阅读、协议签署、随机抽题和后端判分
- QQ 与 Minecraft ID 全状态双向查重，支持申请进度查询
- 管理员登录、分类审核、批量批准/拒绝、记录修改与删除
- RCON 自动白名单、失败重试、执行记录和危险命令拦截
- 自定义站点名称、Logo、文案、服规、协议、题库与合格分数
- 申请入口开关、IP/QQ/Minecraft ID 频率限制和操作日志
- 申请量、通过率、状态分布与最近趋势统计
- 首次部署网页向导、敏感配置加密、SQLite 持久化与备份
- GitHub Release 新版本检测、前后台按需加载和静态资源缓存
- Windows 与 Linux 双平台 CI、大小写导入和换行符自动检查

## 架构

```text
互联网用户
    │
    ▼ HTTPS :443
Caddy 反向代理
    │ Compose 内部网络
    ▼ :47821
Craft Pass（React 静态页面 + Node.js API）
    ├── SQLite / 运行配置 / 加密密钥  ──► ./data
    └── Minecraft RCON               ──► Minecraft 服务端
```

第一版只使用一个应用容器，不需要把前端、后端和 SQLite 拆成多个服务。Caddy 是独立的反向代理容器。

## 开始前：确认项目根目录

所有 npm 和 Docker 命令都必须在包含下列文件的目录中执行：

```text
package.json
compose.yaml
frontend/
backend/
```

Windows PowerShell 可以这样确认：

```powershell
Test-Path .\package.json
```

Ubuntu/macOS 可以这样确认：

```bash
test -f package.json && echo "已位于项目根目录"
```

如果 Windows 报错 `Could not read package.json` 或 `ENOENT`，说明当前目录不对。对于下面这种目录结构：

```text
D:\AllMyProject\github_projects\craft_pass\
└── craft-pass\
    ├── package.json
    └── compose.yaml
```

应先执行：

```powershell
cd D:\AllMyProject\github_projects\craft_pass\craft-pass
npm run setup
```

正常使用 `git clone` 时，命令通常是：

```bash
git clone https://github.com/finkkk/craft-pass.git
cd craft-pass
```

## 部署方式对比

| 方式 | 适用场景 | Node.js | HTTPS | 自动恢复 | 推荐度 |
| --- | --- | --- | --- | --- | --- |
| Docker Compose | Ubuntu 公网生产环境 | 镜像内固定 | Caddy 自动配置 | 支持 | ⭐⭐⭐⭐⭐ |
| Windows 本机运行 | 本地体验、开发和调试 | 需要手动安装 | 默认无 | 不支持 | ⭐⭐⭐ |
| Ubuntu 直接运行 Node.js | 已有进程管理和反代体系 | 需要手动维护 | 自行配置 | 需 systemd/PM2 | ⭐⭐⭐ |

## 方式一：Docker Compose 部署（推荐）

### 1. 准备环境

Ubuntu 服务器需要：

- Git
- Docker Engine
- Docker Compose 插件（能够运行 `docker compose version`）
- 指向服务器公网 IP 的域名（正式 HTTPS 部署需要）

不需要在宿主机安装 Node.js、npm、SQLite 或 Caddy。

### 2. 获取代码和创建配置

```bash
git clone https://github.com/finkkk/craft-pass.git
cd craft-pass
cp .env.example .env
```

编辑 `.env`，正式部署至少修改以下项目：

```dotenv
SITE_ADDRESS=apply.example.com
CORS_ORIGINS=https://apply.example.com
APP_SECRET=请替换为至少32位的随机字符串

RCON_ENABLED=false
RCON_HOST=host.docker.internal
RCON_PORT=25575
RCON_PASSWORD=请替换为真实RCON密码
```

生成随机密钥：

```bash
openssl rand -base64 48
```

本机仅用 HTTP 测试时，可以保留：

```dotenv
SITE_ADDRESS=:80
CORS_ORIGINS=http://localhost
```

> [!CAUTION]
> `.env` 包含密钥，不能提交到 Git。`.env.example` 只能保存示例值。

### 3. 构建并启动

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

应用启动时会先执行 `prisma migrate deploy`，成功后再启动 HTTP 服务。首次运行时，日志会显示一次性部署令牌。

访问：

```text
https://apply.example.com/setup
```

本机 HTTP 测试访问：

```text
http://localhost/setup
```

### 4. 日常 Docker 命令

```bash
# 查看容器状态
docker compose ps

# 查看全部日志或只看应用日志
docker compose logs -f
docker compose logs -f app

# 重启
docker compose restart

# 停止并移除容器（不会删除 ./data）
docker compose down

# 拉取代码并更新
git pull
docker compose up -d --build
```

`restart: unless-stopped` 会在 Docker 或 Ubuntu 重启后自动恢复服务。

完整的生产部署、目录权限、备份和防火墙说明见：[Linux / Docker Compose 生产部署](docs/docker-deployment.md)。

## 方式二：Windows 本机运行

适用于首次体验和开发调试。

### 1. 安装环境

- Node.js `>=22.12.0`（推荐 Node.js 22 LTS）
- npm `>=10`
- Git

检查版本：

```powershell
node --version
npm --version
```

### 2. 获取代码并进入正确目录

```powershell
git clone https://github.com/finkkk/craft-pass.git
cd .\craft-pass
Test-Path .\package.json
```

最后一条命令必须返回 `True`。

如果你已经处于本项目当前工作区的外层目录，请执行：

```powershell
cd .\craft-pass
```

### 3. 一键安装、构建、迁移并启动

```powershell
npm run setup
```

该命令会：

1. 根据前后端 `package-lock.json` 执行 `npm ci`；
2. 构建 React 前端和 Node.js 后端；
3. 创建并迁移 SQLite 数据库；
4. 启动单端口服务。

保持 PowerShell 窗口运行，访问控制台显示的地址，默认是：

```text
http://localhost:47821/setup
```

### 4. 以后再次启动

```powershell
npm start
```

`npm start` 会重新构建当前代码并启动服务。如果只是部署新版本并执行数据库迁移：

```powershell
npm run deploy
```

## 方式三：Ubuntu 直接运行 Node.js

如果已有 Nginx/Caddy、systemd 或 PM2 运维体系，也可以不使用 Docker。

```bash
git clone https://github.com/finkkk/craft-pass.git
cd craft-pass

# 使用 .nvmrc 中声明的 Node.js 22
nvm install
nvm use

cp backend/.env.example backend/.env
npm run ci:all
npm run check:platform
npm run deploy
NODE_ENV=production npm run start:server
```

生产环境不能依靠 SSH 窗口长期保持进程。请使用 systemd、PM2 或其他进程管理器，并配置 Nginx/Caddy HTTPS 反向代理。

直接运行 Node.js 时，数据默认保存在 `backend/data/`；Docker 部署时保存在仓库根目录的 `data/`。

## 首次初始化与日常使用

### 初始化向导

打开 `/setup`，输入启动日志中的一次性部署令牌，然后配置：

1. 站点名称和副标题；
2. 首个管理员账号和密码；
3. HTTP 服务端口（Docker 中固定为 `47821`）；
4. 是否启用 RCON；
5. RCON 主机、端口、密码和白名单命令。

初始化完成后，一次性令牌立即失效，`/setup` 不再允许重复初始化。

### 页面入口

| 页面 | 默认地址 | 用途 |
| --- | --- | --- |
| 玩家入口 | `/` | 阅读服规、填写资料和答题 |
| 进度查询 | 玩家入口内 | 使用 QQ + Minecraft ID 查询 |
| 管理后台 | `/admin` | 登录和审核申请 |
| 数据统计 | `/admin/statistics` | 申请趋势和通过率 |
| 题库与服规 | `/admin/content` | 编辑协议、题目和合格分数 |
| 界面定制 | `/admin/appearance` | 站点名称、Logo 和文案 |
| RCON 控制台 | `/admin/rcon` | 测试连接和发送允许的命令 |
| 系统配置 | `/admin/settings` | 申请限制、端口和 RCON 设置 |

### Minecraft RCON 准备

Minecraft Java 服务端的 `server.properties` 通常需要：

```properties
white-list=true
enable-rcon=true
rcon.port=25575
rcon.password=请使用高强度密码
```

修改后重启 Minecraft 服务端。不要把 RCON 端口直接暴露到公网；只允许 Craft Pass 所在主机或 Docker 网络访问。

默认白名单命令：

```text
whitelist add {minecraftId}
```

`{minecraftId}` 是必需占位符，系统会在审核通过时替换为玩家 ID。

## 数据与备份

| 部署方式 | 持久化目录 |
| --- | --- |
| Docker Compose | `./data/` |
| 直接运行 Node.js | `./backend/data/` |

目录中包含 SQLite 数据库、题库、站点配置、Logo、部署令牌和用于解密 RCON 密码的密钥。必须整体备份，不能只复制 `.db` 文件。

Docker 一致性备份示例：

```bash
docker compose stop app
tar -czf craft-pass-data-$(date +%F).tar.gz data
docker compose start app
```

恢复前先停止应用，再完整替换数据目录，并确认文件权限允许容器用户读写。

## 更新与回滚

Docker 更新：

```bash
git pull
docker compose up -d --build
docker compose logs -f app
```

Node.js 更新：

```bash
git pull
npm run ci:all
npm run deploy
npm run start:server
```

升级前先备份数据目录。回滚代码时也要考虑数据库迁移是否向后兼容，不要只回滚镜像而忽略数据库结构。

## 开发与质量检查

前后端热更新需要两个终端：

```bash
npm run dev:backend
npm run dev:frontend
```

开发检查：

```bash
npm run check:platform
npm run typecheck
npm test
npm run build
```

`check:platform` 会检查相对导入的文件名大小写、Shell 脚本 CRLF 和 package 脚本中的 Windows 专属命令。GitHub Actions 会同时在 Ubuntu 和 Windows 上运行安装、测试和构建。

## 常见问题

### `ENOENT: no such file or directory, open ... package.json`

当前目录不是项目根目录。先查找 `package.json`：

```powershell
Get-ChildItem -Recurse -Filter package.json | Select-Object -First 5 FullName
```

然后 `cd` 到同时包含根 `package.json`、`frontend/` 和 `backend/` 的目录。你的当前工作区应使用：

```powershell
cd D:\AllMyProject\github_projects\craft_pass\craft-pass
```

### `/bin/bash^M: bad interpreter`

Shell 文件被保存为 CRLF。仓库的 `.gitattributes` 已强制 `*.sh` 使用 LF。重新检出文件，或在编辑器右下角把行尾切换为 LF。

### Docker 日志出现 `EACCES`

宿主机 `data/` 不允许容器内的非 root 用户写入。Ubuntu 常见修复：

```bash
sudo chown -R 1000:1000 data
docker compose restart app
```

### 页面能打开但 API 被 CORS 拒绝

让 `.env` 中的 `CORS_ORIGINS` 与浏览器地址完全一致，包括 `http/https` 和端口：

```dotenv
CORS_ORIGINS=https://apply.example.com
```

修改后执行 `docker compose up -d` 重新创建容器。

### Docker 中无法连接宿主机 Minecraft RCON

不要使用 `127.0.0.1`，它指向应用容器自身。使用：

```dotenv
RCON_HOST=host.docker.internal
```

Compose 已为 Linux 配置 `host-gateway` 映射。同时检查 Minecraft 是否监听对应地址以及防火墙规则。

### 端口被占用

Windows：

```powershell
Get-NetTCPConnection -LocalPort 47821 -ErrorAction SilentlyContinue
```

Ubuntu：

```bash
ss -ltnp | grep 47821
```

Docker 模式下应用内部端口固定为 `47821`，公网入口由 Caddy 的 80/443 提供。

## 项目结构

```text
craft-pass/
├── frontend/              React + Vite 前端
├── backend/               Express + Prisma 后端
│   ├── prisma/            SQLite Schema 和 migrations
│   └── data/              Node.js 直跑模式的数据目录
├── data/                  Docker 持久化数据目录
├── docs/                  API、数据库、部署和运维文档
├── scripts/               跨平台安装、启动和检查脚本
├── Dockerfile
├── compose.yaml
├── Caddyfile
└── .env.example
```

## 更多文档

- [Linux / Docker Compose 生产部署](docs/docker-deployment.md)
- [部署与首次初始化](docs/deployment.md)
- [日常运维与故障排查](docs/operations.md)
- [API 说明](docs/api.md)
- [数据库与迁移](docs/database.md)
- [发布状态](docs/release-status.md)

## 参与贡献

欢迎提交 Issue 和 Pull Request。提交前请运行：

```bash
npm run check:platform
npm run typecheck
npm test
npm run build
```

## License

本项目基于 [MIT License](LICENSE) 开源。
