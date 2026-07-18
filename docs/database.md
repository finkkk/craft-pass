# 数据模型

## 核心表

### `applications`

保存玩家身份、协议签署、答题结果与审核状态。`minecraft_id_normalized` 用于执行不区分大小写的重复检查，原始 `minecraft_id` 用于展示和执行白名单命令。只有通过答题并进入审核流程的记录会占用 QQ 和 Minecraft ID；`quiz_failed` 会保留用于统计，但不会阻止玩家使用相同身份重考。

`identity_locked` 用于兼容升级前可能已经存在的历史重复数据。通过答题的新建记录会设为 `true`，并受到 QQ 与 Minecraft ID 两个部分唯一索引保护；答题失败记录保持 `false`。旧的非失败记录即使未锁定，应用服务查询时仍会参与冲突判断。

### `admins`

保存管理员用户名、密码哈希和角色。任何情况下都不保存明文密码。

### `admin_sessions`

保存管理员登录会话的 SHA-256 令牌摘要、有效期和最近使用时间。浏览器中的原始随机令牌只通过 `httpOnly` Cookie 传输，退出登录后对应记录立即删除。

### `admin_logs`

保存登录、通过、拒绝、RCON 重试等关键管理操作。管理员或目标申请被删除时保留日志主体，仅将关联字段置空。

### `rcon_attempts`

每次 RCON 执行单独记录，包含执行状态、响应、错误和时间。这样重试不会覆盖之前的失败记录。

批准申请时先创建 `PENDING` 执行记录，以阻止同一申请被并发重复执行。成功后记录变为 `SUCCEEDED`，申请进入 `whitelisted`；失败后记录变为 `FAILED`，申请进入 `rcon_failed`。

## 申请状态

```text
quiz_failed

pending_review ──→ rejected
       │
       ├────────→ whitelisted
       │
       └────────→ rcon_failed ──→ whitelisted
```

`quiz_failed`、`rejected` 和 `whitelisted` 是终态。相同状态不能重复流转，`rcon_failed` 只能在重试成功后进入 `whitelisted`。

状态流转由后端领域逻辑统一检查，不能直接信任前端传入的状态。

## 数据库文件

默认开发数据库：

```text
backend/data/craft-pass.db
```

数据库文件与 WAL 临时文件均属于运行数据，不进入版本库；迁移文件必须提交。
