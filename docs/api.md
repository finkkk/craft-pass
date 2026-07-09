# API 接口

当前公开接口统一使用 `/api` 前缀，JSON 错误响应包含稳定的 `code`、可读的 `message` 和用于排查日志的 `requestId`。

## 获取当前协议

```http
GET /api/agreement
```

返回当前协议版本、规则章节与签署声明。玩家提交申请时必须原样携带当前 `agreementVersion`。

## 获取答题题目

```http
GET /api/quiz
```

返回合格分数、题目数量、题目和选项。响应不会包含正确答案。

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
  "answers": {
    "q1": "C",
    "q2": "A"
  }
}
```

实际提交必须回答当前全部题目。后端独立判分，并保存每道题的选择及是否正确。

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
- `ACTIVE_APPLICATION_EXISTS`：该 Minecraft ID 已经待审核、在白名单中或等待 RCON 重试。
- `APPLICATION_RATE_LIMIT_EXCEEDED`：15 分钟内提交超过 10 次。

答题结果低于后台配置的合格分数仍会创建记录，状态为 `quiz_failed`；响应只返回分数，不返回正确答案。

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
GET  /api/admin/logo
PUT  /api/admin/logo
DELETE /api/admin/logo
GET  /api/admin/applications?status=pending_review
GET  /api/admin/applications/:id
PATCH /api/admin/applications/:id
DELETE /api/admin/applications/:id
GET  /api/admin/rcon/status
GET  /api/admin/settings
PUT  /api/admin/settings
POST /api/admin/applications/:id/approve
POST /api/admin/applications/:id/reject
POST /api/admin/applications/:id/retry-rcon
```

除登录外，所有管理员接口都必须携带有效会话 Cookie。前端请求需要设置 `credentials: "include"`。

统计接口返回累计申请、近 7 天申请、答题通过率、已审核申请通过率、RCON 成功率、状态分布和最近 14 天每日趋势。没有已完成 RCON 尝试时，`rconSuccessRate` 返回 `null`。

内容配置接口用于读取和保存服规章节、签署声明、协议版本、合格分数和单选题题库。管理员响应包含正确答案；公开的 `/api/quiz` 会主动移除 `correctOptionId`。保存后的题库立即用于后端校验与判分。

Logo 接口支持上传不超过 400KB 的 PNG、JPEG 或 WebP 图片，也可以删除自定义图片并恢复默认 CP 图标。公开图片通过 `GET /api/site-logo` 提供。

批准接口只接收申请 ID。Minecraft ID 与实际命令均由后端从数据库和环境配置生成，前端无法提交任意 RCON 命令。

拒绝请求示例：

```json
{
  "reason": "信息异常，需要联系管理员确认"
}
```

RCON 执行失败时接口返回错误，同时申请状态变为 `rcon_failed` 并保存失败记录；管理员随后可以调用重试接口。

系统配置接口用于修改站点名称与 RCON 参数。读取配置时只返回 `passwordConfigured`，绝不返回 RCON 密码；更新时省略或留空密码表示保持原值。

修改申请记录只允许更新 QQ 号和 Minecraft ID，并继续执行与玩家申请相同的格式校验。修改已通过记录不会自动执行 RCON 命令。删除申请会同时删除其 RCON 尝试记录，但管理员日志会保留被删除记录的快照。
