# Linux / Docker Compose 生产部署

推荐使用 Docker Compose 在 Ubuntu 上运行 Craft Pass。Compose 会启动一个应用容器和一个 Caddy 反向代理；SQLite、运行配置、站点 Logo 和本地密钥保存在宿主机的 `data/` 目录中，不会随容器重建而丢失。

## 准备

服务器只需要安装 Git、Docker Engine 和 Docker Compose 插件，不需要全局安装 Node.js 或 npm。克隆仓库后进入项目目录：

```bash
git clone https://github.com/finkkk/craft-pass.git
cd craft-pass
cp .env.example .env
```

编辑 `.env`：

- `SITE_ADDRESS` 填写公网域名，例如 `apply.example.com`。Caddy 会自动申请和续期 HTTPS 证书。
- `CORS_ORIGINS` 填写完整公网来源，例如 `https://apply.example.com`；多个来源以英文逗号分隔。
- `APP_SECRET` 必须替换为至少 32 位的随机值，可用 `openssl rand -base64 48` 生成。
- RCON 未启用时保持 `RCON_ENABLED=false`。Minecraft 在同一台宿主机上时可使用 `RCON_HOST=host.docker.internal`。

不要提交 `.env`。仓库只跟踪不含真实密钥的 `.env.example`。

## 启动和初始化

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

应用容器每次启动时都会先执行 `prisma migrate deploy`，然后启动服务。首次运行时，从 `app` 日志读取一次性部署令牌，再访问 `https://你的域名/setup` 完成初始化。

容器内的应用端口固定为 `47821`，避免后台修改端口后与健康检查或反向代理失联；对外只使用 Caddy 的 80/443 端口。

仅在本机通过 HTTP 验证时，可以保留示例值：

```dotenv
SITE_ADDRESS=:80
CORS_ORIGINS=http://localhost
```

## 日常操作

```bash
# 拉取代码、重建并滚动替换容器
git pull
docker compose up -d --build

# 查看状态和日志
docker compose ps
docker compose logs -f

# 重启或停止
docker compose restart
docker compose down
```

`restart: unless-stopped` 会让服务在 Docker 或 Ubuntu 重启后自动恢复。`docker compose down` 不会删除 `./data`；不要使用 `docker compose down -v`，除非明确要删除 Caddy 管理的数据卷。

## 数据、权限与备份

持久化映射为：

```yaml
volumes:
  - ./data:/app/backend/data
```

必须完整备份 `data/`，其中不仅有 SQLite 数据库，也有运行配置和用于解密 RCON 密码的密钥。为了获得一致备份，先暂停写入或短暂停止应用：

```bash
docker compose stop app
tar -czf craft-pass-data-$(date +%F).tar.gz data
docker compose start app
```

应用以镜像内的非 root `node` 用户运行。如果日志出现 `EACCES`，请确认 `data/` 对容器用户可写；常见 Ubuntu 主机的首个普通用户 UID 为 1000，可执行：

```bash
sudo chown -R 1000:1000 data
```

## 网络与安全

- 防火墙只需向公网开放 SSH、80 和 443；应用端口 `47821` 只存在于 Compose 内部网络。
- 不要向公网开放 Minecraft RCON 端口。只允许 Docker 网段或应用所在主机访问。
- 正式域名必须使用 HTTPS，并让 `CORS_ORIGINS` 与浏览器地址严格一致。
- 定期更新宿主机、Docker 镜像和项目依赖，并在升级前备份 `data/`。
- 若使用 Cloudflare 等额外代理，仍应保留 Caddy 到客户端链路的 HTTPS，并核对真实客户端 IP 转发策略。

## 不使用 Docker 的部署

Node.js 部署要求 Node.js `>=22.12.0` 和 npm `>=10`。仓库的 `.nvmrc` 固定主版本为 22。安装应使用锁文件：

```bash
nvm use
npm run ci:all
npm run check:platform
npm run deploy
NODE_ENV=production npm run start:server
```

`npm run ci:all` 会分别在 `frontend/` 和 `backend/` 中执行 `npm ci`。不要用无锁的 `npm install` 替代生产安装。
