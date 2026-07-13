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

默认部署不需要 `.env`，也不需要在宿主机安装 OpenSSL：

- 应用使用 Node.js `crypto.randomBytes(32)` 自动生成密钥；
- 密钥保存在持久化的 `data/app-secret.key`，容器重建后仍然有效；
- 首次部署令牌自动生成并显示在日志；
- SQLite 数据库和 migrations 自动初始化；
- 镜像内已安装 Prisma 构建和迁移所需的 OpenSSL；
- `data-init` 会在应用启动前自动修正 `data/` 的所有权；
- RCON 默认关闭，可在网页初始化向导或后台中配置；
- 默认地址为 `http://localhost:47821/setup`。

只有接入公网域名、改变宿主机端口或希望预填 RCON 时，才复制 `.env.example`：

```bash
cp .env.example .env
```

如果在 `.env` 中填写了真实密码或固定密钥，不要提交该文件。

## 小内存服务器构建

Dockerfile 默认将构建阶段的 Node.js 堆内存限制为 768 MiB，关闭 npm audit/fund 请求，将原生依赖编译并发限制为 1，并使用 BuildKit 缓存复用 npm 下载。它可以降低构建峰值并避免 Node.js 无限制占用内存，但不会为宿主机自动创建 Swap，也不会修改服务器的系统配置。

默认直接构建即可：

```bash
docker compose build app
docker compose up -d
```

如果服务器内存充足，或者未来项目构建确实需要更大的 Node.js 堆，可覆盖默认值：

```bash
docker compose build --build-arg NODE_MAX_OLD_SPACE_SIZE=1536 app
docker compose up -d
```

该参数只影响镜像构建，不限制应用容器运行时内存。如果极低配置服务器仍无法完成构建，应在其他机器或 CI 中构建镜像后再部署，而不是由项目自动改变宿主机的 Swap 设置。

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

Compose 启动时会先运行一次性的 `data-init` 服务，再启动应用。应用容器每次启动都会使用镜像内的 `prisma.config.ts` 执行 `prisma migrate deploy`，迁移成功后才启动 HTTP 服务。首次运行时，从日志读取一次性部署令牌：

```bash
docker compose logs -f app
```

`data-init` 显示 `Exited (0)` 表示权限初始化成功，不是服务异常。再访问公网域名的 `/setup` 完成初始化。容器内端口固定为 `47821`，避免后台修改端口后与健康检查或反向代理失联。

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

短语法 bind mount 会遮蔽镜像构建阶段设置的目录所有权。为避免首次启动时出现 SQLite `EACCES`，Compose 中的 `data-init` 会以 root 身份修正挂载目录，然后退出；长期运行的 `app` 仍使用非 root `node` 用户。

一般不再需要手动执行 `chown`。如果使用 NFS、rootless Docker 或手工以其他用户修改过 `data/`，可以重新执行权限初始化并启动应用：

```bash
docker compose run --rm data-init
docker compose up -d app
```

如果初始化服务本身提示宿主机文件系统不允许修改所有权，需要由服务器管理员为 `data/` 授予容器内 `node` 用户对应 UID/GID 的读写权限，或将该 bind mount 改为 Docker named volume。

### 启动失败快速检查

```bash
docker compose ps -a
docker compose logs --tail=200 data-init app
```

- `data-init` 非零退出：宿主机数据目录不允许修改所有权。
- `The SQLite data path is not writable`：应用用户仍无法写入挂载目录。
- `Prisma config is missing from the runtime image`：当前镜像过旧或构建不完整，重新执行 `docker compose build --no-cache app`。
- OpenSSL 或 `datasource.url` 报错：确认已经拉取包含本次 Dockerfile 修复的代码并重新构建镜像。

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
