# 性能与运维

## 请求与限流

Craft Pass 将请求分为三类：

- GET、HEAD、OPTIONS：普通页面读取，不消耗全局写操作额度，并使用至少 600 次/窗口的独立宽松保护。
- PUT、PATCH、POST、DELETE：受 `RATE_LIMIT_WINDOW_MS` 与 `RATE_LIMIT_MAX` 控制。
- 登录、首次部署、申请提交、身份查重与进度查询：使用更严格的独立限流器。

因此快速切换管理后台页面不应再触发 HTTP 429。若写操作确实达到上限，前端会显示后端返回的具体错误，而不会把 429 描述为网络断开。

如果反向代理后所有用户被识别为同一个 IP，请确认代理会覆盖而不是追加不可信的转发头，并且只在可信代理后设置：

```dotenv
TRUST_PROXY=true
```

不要在应用直接暴露公网时盲目启用该配置。

## 缓存策略

- 部署状态和管理员会话在前端会话内复用。
- 管理员 GET 请求有 3 秒去重缓存，写操作会立即清空该缓存。
- 题库和运行配置在后端进程内缓存，后台保存时同步刷新。
- GitHub Release 检查结果缓存 6 小时。
- `/assets/` 使用一年 `immutable` 缓存，HTML 使用 `no-cache`。

手工修改 `backend/data/*.json` 后需要重启服务；推荐始终通过管理后台修改配置。

## HTTP 429 排查

1. 查看响应 JSON 中的 `error.code`，区分全局写限流、登录限流、提交限流和查询限流。
2. 查看 `Retry-After` 或标准 `RateLimit` 响应头。
3. 检查反向代理 IP 配置和 `TRUST_PROXY`。
4. 确认浏览器没有插件或脚本持续重复发送写请求。
5. 不建议单纯把限制调到极大；应先确认是哪一种请求异常增长。

## 数据库与备份

SQLite 适合单实例部署。不要让多个 Craft Pass 进程同时写入同一个数据库文件，也不要把数据库放在不可靠的网络文件系统上。

Docker Compose 部署会通过一次性的 `data-init` 服务修正 bind mount 所有权，应用仍以非 root 用户运行。权限异常时执行：

```bash
docker compose run --rm data-init
docker compose up -d app
```

升级前完整备份 `backend/data`，然后执行：

```bash
npm run deploy
```

测试、类型检查和生产构建：

```bash
npm test
npm run typecheck
npm run build
```

## 日常健康检查

```http
GET /api/health
```

该接口只表示 HTTP 服务存活。RCON 状态需要登录管理后台查看；GitHub 版本检查失败不会影响健康状态、玩家申请或管理员审核。
