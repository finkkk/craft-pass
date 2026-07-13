# Linux / Docker Compose 生产部署

Craft Pass 的 Compose 配置默认启动应用容器，并把服务绑定到宿主机 `127.0.0.1:47821`。反向代理有两种选择：

- 服务器已有 Nginx：复用现有 Nginx，默认不启动 Caddy。
- 服务器没有反向代理：启用 Compose 中的可选 `caddy` profile，自动管理 HTTPS。

SQLite、运行配置、站点 Logo 和本地密钥保存在宿主机 `data/`，不会随容器重建而丢失。

## 零配置启动

服务器需要 Git、Docker Engine 和 Docker Compose 插件，不需要全局安装 Node.js 或 npm。

```bash
git clone https://github.com/finkkk/craft-pass.git
cd craft-pass
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

默认部署不需要 `.env` 或 OpenSSL：

- 应用使用 Node.js `crypto.randomBytes(32)` 自动生成密钥；
- 密钥保存在持久化的 `data/app-secret.key`，容器重建后仍然有效；
- 首次部署令牌自动生成并显示在日志；
- SQLite 数据库和 migrations 自动初始化；
- RCON 默认关闭，可在网页初始化向导或后台中配置；
- 默认地址为 `http://localhost:47821/setup`。

只有接入公网域名、改变宿主机端口或希望预填 RCON 时，才复制 `.env.example`：

```bash
cp .env.example .env
```

如果在 `.env` 中填写了真实密码或固定密钥，不要提交该文件。

## 方案 A：复用宿主机 Nginx

此时应用监听 `127.0.0.1:47821`，不能直接从外网访问。添加 Nginx 站点：

```nginx
server {
    listen 443 ssl;
    server_name apply.example.com;

    ssl_certificate     /etc/letsencrypt/live/apply.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/apply.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:47821;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

验证并加载配置：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

使用公网域名时创建 `.env` 并设置：

```dotenv
CORS_ORIGINS=https://apply.example.com
```

Nginx 和 Caddy 在本项目中作用相同：终止 HTTPS、接收公网流量，再转发到 Craft Pass。已有 Nginx 时没有必要再运行 Caddy。

## 方案 B：启用内置 Caddy

本机 HTTP 使用内置 Caddy 时不需要 `.env`：

```bash
docker compose --profile caddy up -d --build
```

公网域名部署时，确保宿主机 80/443 没有被 Nginx、Apache 等服务占用，然后创建 `.env` 并设置：

```dotenv
SITE_ADDRESS=apply.example.com
CORS_ORIGINS=https://apply.example.com
```

启动：

```bash
docker compose --profile caddy up -d --build
docker compose ps
docker compose logs -f app caddy
```

Caddy 会自动申请和续签 HTTPS 证书。其证书数据保存在 Docker 命名卷 `caddy_data`。

## 本机 HTTP 验证

不启动任何反向代理，直接启动应用：

```bash
docker compose up -d --build
```

访问 `http://localhost:47821/setup`。

## 启动流程与初始化

应用容器每次启动都会先执行 `prisma migrate deploy`，然后启动服务。首次运行时，从日志读取一次性部署令牌：

```bash
docker compose logs -f app
```

再访问公网域名的 `/setup` 完成初始化。容器内端口固定为 `47821`，避免后台修改端口后与健康检查或反向代理失联。

## 更新和日常操作

```bash
# 更新应用；使用内置 Caddy 时给 up 命令追加 --profile caddy
git pull
docker compose up -d --build

docker compose ps
docker compose logs -f app
docker compose restart app
docker compose down
```

使用内置 Caddy 更新时执行：

```bash
git pull
docker compose --profile caddy up -d --build
```

`restart: unless-stopped` 会让服务在 Docker 或 Ubuntu 重启后自动恢复。`docker compose down` 不会删除 `data/`。不要执行 `docker compose down -v`，除非明确要删除 Caddy 证书卷。

## 数据、权限与备份

持久化映射：

```yaml
volumes:
  - ./data:/app/backend/data
```

必须完整备份 `data/`，其中包含 SQLite、运行配置以及用于解密 RCON 密码的密钥。

```bash
docker compose stop app
tar -czf craft-pass-data-$(date +%F).tar.gz data
docker compose start app
```

应用以非 root `node` 用户运行。若日志出现 `EACCES`，确认目录允许容器用户写入；常见 Ubuntu 主机可执行：

```bash
sudo chown -R 1000:1000 data
```

## 网络与安全

- 使用宿主机 Nginx 时，应用端口只绑定 `127.0.0.1`，无需向防火墙开放 `47821`。
- 使用内置 Caddy 时，只向公网开放 SSH、80 和 443。
- 不要向公网开放 Minecraft RCON 端口。
- 正式域名必须使用 HTTPS，且 `CORS_ORIGINS` 必须与浏览器来源完全一致。
- 使用 Cloudflare 等上游代理时，核对真实客户端 IP 和 HTTPS 转发策略。
- 升级前完整备份 `data/`。

## 不使用 Docker

Node.js 部署要求 Node.js `>=22.12.0` 和 npm `>=10`：

```bash
nvm use
npm run ci:all
npm run check:platform
npm run deploy
NODE_ENV=production npm run start:server
```

直接运行 Node.js 时需要自行配置 Nginx/Caddy 和 systemd/PM2，并持久化 `backend/data/`。
