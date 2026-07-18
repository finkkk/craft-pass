# API 接口

当前公开接口统一使用 `/api` 前缀，JSON 错误响应包含稳定的 `code`、可读的 `message` 和用于排查日志的 `requestId`。

普通 GET、HEAD 和 OPTIONS 使用独立的宽松读取限流；写操作使用 `RATE_LIMIT_MAX`。超过读取额度返回 `READ_RATE_LIMIT_EXCEEDED`，超过写操作额度返回 `RATE_LIMIT_EXCEEDED`。登录、部署、申请提交和身份查询还有各自的专用错误码与额度。

## 获取当前协议

```http
GET /api/agreement
```

返回当前协议版本、规则章节、签署声明、玩家端界面文案 `ui`，以及申请入口开关 `application.submissionsEnabled`。玩家提交申请时必须原样携带当前 `agreementVersion`。

## 获取答题题目

```http
GET /api/quiz
```

返回合格分数、本次题目数量、题库总数、题目、选项和签名后的 `quizToken`。响应不会包含正确答案。

题目会在每次请求时随机排序；启用随机抽题后只返回本次抽中的题目。提交答案时必须原样带回 `quizToken`，后端会校验答案题目与本次抽题一致。

## 提交申请

```http
POST /api/applications
Content-Type: application/json
```

请求示例：

```json
{
  "qqNumber": "123456789",
  "minecraftId": "Steve_01",
  "agreementVersion": "2026-07-09-v1",
  "agreementAccepted": true,
  "quizToken": "题目接口返回的签名凭证",
  "answers": {
    "q1": "C",
    "q2": "A"
  }
}
```

实际提交必须回答本次抽取的全部题目。后端独立判分，并保存每道题的选择及是否正确。

成功响应使用 HTTP `201`：

```json
{
  "applicationId": "申请 ID",
  "minecraftId": "Steve_01",
  "qqNumber": "123456789",
  "status": "pending_review",
  "score": 90,
  "passed": true,
  "submittedAt": "2026-07-09T00:00:00.000Z"
}
```

可能的业务错误：

- `VALIDATION_ERROR`：字段格式错误、漏答或包含未知题目。
- `AGREEMENT_VERSION_OUTDATED`：协议已经更新，需要重新阅读。
- `IDENTITY_CONFLICT`：QQ、Minecraft ID 或两者已被通过答题的申请占用；`details` 会指出发生冲突的字段。仅有答题失败记录时允许重新提交。
- `APPLICATION_SUBMISSIONS_DISABLED`：后台暂时关闭了新申请入口。
- `APPLICATION_RATE_LIMIT_ACTIVE`：同 IP 在后台配置的时间窗口内提交次数过多。
- `APPLICATION_RATE_LIMIT_EXCEEDED`：15 分钟内提交超过 10 次。

答题结果低于后台配置的合格分数仍会创建记录，状态为 `quiz_failed`；响应只返回分数，不返回正确答案。该记录不占用 QQ 或 Minecraft ID，玩家可以使用相同身份重新考试。

## 查询申请进度

```http
POST /api/applications/status
Content-Type: application/json
```

```json
{
  "qqNumber": "123456789",
  "minecraftId": "Steve_01"
}
```

查询成功会返回状态、分数、提交与审核时间；仅当状态为 `rejected` 时返回管理员填写的拒绝原因。QQ 与 Minecraft ID 必须同时匹配同一条申请，避免仅凭公开的游戏名查询他人的审核信息。

玩家进入规则页面前可调用 `POST /api/applications/identity-check`，请求体同样包含 `qqNumber` 和 `minecraftId`。可用时返回 `{ "available": true }`；冲突时返回 `IDENTITY_CONFLICT`。最终提交接口仍会再次查重。

## 健康检查

```http
GET /api/health
```

用于检查后端 HTTP 服务是否存活。

## 管理员接口

管理员接口统一使用 `/api/admin` 前缀。登录成功后，后端通过 `httpOnly`、`SameSite=Strict` Cookie 保存随机会话令牌，数据库只保存令牌摘要。

```http
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/session
GET  /api/admin/summary
GET  /api/admin/statistics
GET  /api/admin/content
PUT  /api/admin/content
PUT  /api/admin/content/rules-quiz
PUT  /api/admin/content/ui
GET  /api/admin/logo
PUT  /api/admin/logo
DELETE /api/admin/logo
GET  /api/admin/applications?status=pending_review
GET  /api/admin/applications/:id
PATCH /api/admin/applications/:id
DELETE /api/admin/applications/:id
GET  /api/admin/rcon/status
POST /api/admin/rcon/command
POST /api/admin/system/factory-reset
GET  /api/admin/settings
PUT  /api/admin/settings
GET  /api/admin/version
POST /api/admin/applications/batch-review
POST /api/admin/applications/:id/approve
POST /api/admin/applications/:id/reject
POST /api/admin/applications/:id/retry-rcon
```

除登录外，所有管理员接口都必须携带有效会话 Cookie。前端请求需要设置 `credentials: "include"`。

系统配置响应的 `server` 字段包含目标 `port`、本进程正在使用的 `activePort` 和 `restartRequired`。`PUT /api/admin/settings` 可传入 `server.port`（1–65535）；端口保存后需要重启服务才会生效。为兼容旧客户端，更新请求可省略 `server`，此时保留原端口。

批量审核一次最多处理 20 条记录，`action` 可为 `approve`、`reject` 或 `retry`。后端逐条执行并返回每条成功或失败结果；其中一条失败不会回滚已经完成的其他记录。单条和批量拒绝的 `reason` 都可以省略，填写后玩家可在进度查询中看到。

统计接口返回累计申请、近 7 天申请、答题通过率、已审核申请通过率、RCON 成功率、状态分布和最近 14 天每日趋势。没有已完成 RCON 尝试时，`rconSuccessRate` 返回 `null`。

内容配置接口用于读取和保存玩家端界面文案、服规章节、签署声明、协议版本、合格分数和单选题题库。管理员响应包含正确答案；公开的 `/api/quiz` 会主动移除 `correctOptionId` 并随机排序。保存后的题库立即用于后端校验与判分。

`PUT /api/admin/content` 会保存完整内容配置，主要用于兼容旧后台或自动化脚本。后台页面优先使用更窄的接口：`/content/rules-quiz` 只保存服规、签署声明、协议版本、合格分数和题库；`/content/ui` 只保存玩家端显示文案，避免不同页面互相覆盖未编辑的配置。

Logo 接口支持上传不超过 400KB 的 PNG、JPEG 或 WebP 图片，也可以删除自定义图片并恢复默认 CP 图标。公开图片通过 `GET /api/site-logo` 提供；`HEAD /api/site-logo` 可用于轻量检测是否已配置自定义 Logo。

批准接口只接收申请 ID。Minecraft ID 与实际白名单命令均由后端从数据库和环境配置生成，前端不能篡改白名单目标。接口成功或失败都会在申请详情中保存 RCON 输出或错误，便于管理员确认是否过白成功。

拒绝请求示例：

```json
{
  "reason": "信息异常，需要联系管理员确认"
}
```

RCON 执行失败时接口返回错误，同时申请状态变为 `rcon_failed` 并保存失败记录；管理员随后可以调用重试接口。

RCON 状态接口会在已启用时尝试认证连接，并返回 `connected`、`errorMessage`、白名单模板是否完整以及是否配置刷新命令。自定义命令接口仅在 RCON 已启用且连接可用时使用：

```json
{
  "command": "list"
}
```

成功响应包含实际发送的 `command`、服务端 `response` 和 `executedAt`。命令不能包含换行，建议不要带前导斜杠。

自定义命令还会受到系统配置中的 `customCommandsEnabled` 和 `blockedCommands` 约束。危险命令黑名单按命令前缀匹配，例如 `op` 会拦截 `op Steve`，`/stop` 会按 `stop` 识别。

系统配置接口用于修改站点名称、申请入口与提交频率策略、RCON 参数、自定义 RCON 命令开关和危险命令黑名单。读取配置时只返回 `passwordConfigured`，绝不返回 RCON 密码；更新时省略或留空密码表示保持原值。当前后台中站点名称与 Logo 位于“界面定制”，RCON 地址、密码和命令模板位于“系统配置”。

提交频率策略中的“提交统计时段”只用于统计短时间内同 IP 的提交次数，不是玩家答题限时。QQ 与 Minecraft ID 在通过答题后唯一绑定；答题失败记录不占用身份。提交频率仍可能受到同一 IP 短时间提交上限限制。

恢复出厂设置接口需要传入确认文本：

```json
{
  "confirmation": "RESET"
}
```

成功后会删除申请记录、管理员账号、会话、操作日志、RCON 记录、运行配置、题库配置和自定义 Logo，并返回新的 `setupToken`。系统随后回到首次部署状态，前端会跳转到 `/setup` 重新初始化。

修改申请记录只允许更新 QQ 号和 Minecraft ID，并继续执行与玩家申请相同的格式校验。修改已通过记录不会自动执行 RCON 命令。删除申请会同时删除其 RCON 尝试记录，但管理员日志会保留被删除记录的快照。

`POST /api/admin/applications` 可由管理员填写 QQ、Minecraft ID 和 0 至 100 的整数分数手工创建记录，系统按当前合格线自动归入待审核或答题失败。`GET /api/admin/applications` 支持 `status=all` 和 `search` 参数，搜索范围为 QQ 与 Minecraft ID。
