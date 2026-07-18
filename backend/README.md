# Craft Pass Backend

后端负责所有可信业务逻辑，包括输入校验、动态题库判分、管理员鉴权、申请状态流转、数据库访问和 RCON 操作。

## 目录职责

```text
src/
├─ config/       环境变量与后端配置
├─ middleware/   安全、鉴权、限流和错误处理
├─ routes/
│  ├─ public/    玩家及公开接口
│  └─ admin/     必须鉴权的管理员接口
├─ schemas/      Zod 请求数据结构
├─ services/     与 HTTP 无关的业务逻辑
├─ types/        后端共享类型
├─ utils/        小型通用工具
├─ app.ts        Express 应用组装
└─ server.ts     HTTP 服务启动与关闭
```

## 环境变量

复制 `.env.example` 为 `.env` 后再按环境修改。`.env` 已被 Git 忽略。

- `PORT`：首次启动或尚未保存网页配置时使用的 HTTP 监听端口，默认 `47821`。
- `CORS_ORIGINS`：允许访问 API 的前端来源，多个来源用英文逗号分隔。
- `TRUST_PROXY`：仅在可信反向代理后部署时设为 `true`。
- `RATE_LIMIT_WINDOW_MS`：写操作全局限流统计窗口。
- `RATE_LIMIT_MAX`：单个客户端在统计窗口内允许的写操作数量。普通 GET、HEAD 和 OPTIONS 使用至少 600 次/窗口的独立宽松限制；登录、申请提交和身份查询另有更严格限制。

配置会在服务启动时由 Zod 校验；无效配置会阻止服务启动。

## 数据库

数据层使用 Prisma 7、`@prisma/adapter-better-sqlite3` 和 SQLite。数据库文件默认位于 `data/craft-pass.db`，该文件不会提交到 Git。

常用命令：

```bash
npm run db:validate
npm run db:generate
npm run db:migrate:dev -- --name migration_name
npm run db:migrate:deploy
npm run db:smoke
npm run db:studio
```

迁移命令会先确保 SQLite 文件及其目录存在，以兼容不能由 Prisma 原生引擎直接创建数据库文件的 Windows 文件系统。

## 当前公开接口

```http
GET /api/health
GET /api/agreement
GET /api/quiz
POST /api/applications/identity-check
POST /api/applications/status
POST /api/applications
GET /api/setup/status
POST /api/setup/complete
POST /api/admin/login
POST /api/admin/logout
GET /api/admin/session
GET /api/admin/summary
GET /api/admin/statistics
GET /api/admin/content
PUT /api/admin/content
PUT /api/admin/content/rules-quiz
PUT /api/admin/content/ui
GET /api/admin/logo
PUT /api/admin/logo
DELETE /api/admin/logo
GET /api/admin/applications
GET /api/admin/applications/:id
PATCH /api/admin/applications/:id
DELETE /api/admin/applications/:id
GET /api/admin/rcon/status
GET /api/admin/settings
PUT /api/admin/settings
GET /api/admin/version
POST /api/admin/applications/batch-review
POST /api/admin/applications/:id/approve
POST /api/admin/applications/:id/reject
POST /api/admin/applications/:id/retry-rcon
```

申请接口会在后端完成校验、随机题目凭证验证、判分、协议版本检查、全状态身份查重和数据保存。正确答案不会通过公开接口返回。

管理员可以通过 `/admin/content` 修改玩家端界面文案、服规、协议版本、签署声明、合格分数和单选题题库。配置保存在 `data/content-config.json`；不存在该文件时自动使用内置默认内容。

## 创建首个管理员

推荐首次部署直接启动前后端并打开 `/setup`，使用后端控制台显示的一次性部署令牌完成网页初始化。

以下命令仅作为无法使用网页向导时的备用方式。

在 `backend/.env` 中临时填写：

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=至少8位且同时包含字母和数字
```

然后运行：

```bash
npm --prefix backend run admin:create
```

创建成功后立即从 `.env` 删除 `ADMIN_PASSWORD`。命令不会覆盖已有管理员密码。

## RCON 配置

网页部署向导会将 RCON 配置写入 `backend/data/runtime-config.json`，其中密码使用 AES-256-GCM 加密。也可以不使用向导，直接通过后端 `.env` 配置：

```dotenv
RCON_ENABLED=true
RCON_HOST=127.0.0.1
RCON_PORT=25575
RCON_PASSWORD=你的强密码
RCON_TIMEOUT_MS=5000
RCON_WHITELIST_ADD_COMMAND=whitelist add {minecraftId}
RCON_WHITELIST_RELOAD_COMMAND=
```

`RCON_WHITELIST_ADD_COMMAND` 必须包含 `{minecraftId}`。批准时后端从数据库读取并再次校验 Minecraft ID，再替换占位符；前端只能提交申请 ID，不能传入命令。

如果希望加白名单后执行刷新，可以配置：

```dotenv
RCON_WHITELIST_RELOAD_COMMAND=whitelist reload
```

保持 `RCON_ENABLED=false` 时，后台可以查看和拒绝申请，但批准操作会被后端拒绝且不会修改申请状态。

如果运行时配置文件存在，其优先级高于 `.env` 中的 RCON 配置。

管理员登录后可以访问 `/admin/settings` 修改 HTTP 服务端口、站点和 RCON 参数。HTTP 端口保存后需要重启服务生效；密码字段留空会保留原密码，后端接口不会返回密文或明文密码。

玩家通过 QQ 与 Minecraft ID 的精确组合查询审核状态。注册时会分别检查 QQ 和不区分大小写的 Minecraft ID；通过答题并进入审核流程的记录会占用身份，答题失败记录不会占用，玩家可用相同身份重考。管理员拒绝申请时原因可留空，填写后会展示给对应玩家。管理员删除占用记录后，该 QQ 与 Minecraft ID 会立即释放。

通过答题的新建申请和经管理员编辑过的非失败申请会写入 `identity_locked`，由数据库部分唯一索引防止并发请求造成重复绑定。答题失败记录保持未锁定；升级前已有的非失败记录即使未锁定，应用层仍会把它们纳入查重。

题库的 `randomQuestionCount` 为 `null` 时使用全部题目，设置数字后每次随机抽取指定数量。后端会签发短期题目凭证，并在提交时校验，避免客户端自行挑选题目。

服务启动后每 6 小时检查一次 `finkkk/craft-pass` 的 GitHub Releases。请求超时或 GitHub 不可用不会影响申请与审核接口。

运行时配置与题库配置在首次读取后保存在进程内存中；通过后台保存或恢复出厂设置时缓存会同步更新。生产静态资源文件名包含内容哈希，后端会为其设置一年不可变缓存，HTML 保持 `no-cache` 以便更新后及时加载新资源。

## 验证命令

```bash
npm test
npm run typecheck
npm run build
```
