# 首次部署

## 1. 一键首次部署

安装 Node.js 22.12.0 或更高版本后，在项目根目录执行：

```bash
npm run setup
```

该命令会依次安装前后端依赖、构建项目、应用数据库迁移并启动服务。命令窗口必须保持运行，控制台会显示网页部署地址和一次性部署令牌。

以后重新启动无需重复部署：

```bash
npm start
```

`npm start` 会自动构建最新的前端和后端并启动单端口服务。网页和 API 均由 `http://localhost:47821` 提供，不需要另行运行前端开发服务器。数据库迁移只在首次 `npm run setup` 或手动执行 `npm run deploy` 时运行。

## 2. 分步安装与数据库迁移

```bash
npm run install:all
npm --prefix backend run db:migrate:deploy
```

## 3. 本机生产部署

在项目根目录执行：

```bash
npm start
```

`npm start` 会自动构建最新代码，再启动单端口服务。网页和 API 都由 `http://localhost:47821` 提供。

如果只是开发调试，也可以分别启动前后端：

```bash
npm run dev:backend
npm run dev:frontend
```

上述开发命令只用于源码热更新调试。日常部署和验收请直接访问 `http://localhost:47821`，该端口会同时提供网页和 API。

后端发现数据库中没有管理员时，会在控制台显示一次性部署令牌。

## 4. 打开部署向导

访问：

```text
http://localhost:47821/setup
```

也可以直接访问首页；未初始化时系统会自动跳转至部署向导。

向导中需要填写：

- 站点名称与副标题
- 首个管理员用户名和密码（至少 8 位，同时包含字母和数字）
- RCON 主机、端口、密码与超时
- 白名单命令模板
- 后端控制台显示的一次性部署令牌

初始化成功后：

- 首个管理员密码使用 bcrypt 哈希保存
- RCON 密码使用 AES-256-GCM 加密保存
- 一次性部署令牌失效
- `/setup` 不再允许重复初始化
- 可以进入 `/admin/login` 登录后台

完成初始化后，可以在 `/admin/appearance` 修改站点名称、Logo 和玩家端文案，在 `/admin/content` 修改服规与题库，在 `/admin/settings` 修改 HTTP 服务端口、申请入口、同 IP 提交频率限制、RCON 主机、端口、密码、超时、白名单命令、自定义命令开关和危险命令黑名单。这里的“提交统计时段”不是答题限时。RCON 控制台位于 `/admin/rcon`，连接成功且允许自定义命令后可以发送命令并查看服务端输出。除 HTTP 服务端口需要重启进程外，其他新设置会立即用于后续操作。

题库页可设置“每次随机抽题数”；留空表示使用全部题目。玩家可以使用 QQ 与 Minecraft ID 的组合在玩家入口查询审核进度。

升级已有部署时请运行 `npm run deploy`，为申请表添加身份锁定字段和数据库部分唯一索引。旧数据不会因可能存在重复记录而导致迁移失败，但所有旧记录仍参与应用层查重；如需释放被冒用的 QQ 或 Minecraft ID，管理员可在审核后台拒绝后删除该申请，或先修改冲突身份。

版本提醒需要后端能够访问 `api.github.com`。检查请求使用 5 秒超时并缓存 6 小时，网络不可用不会影响系统其他功能。

后台菜单使用站内导航，不会因切换页面重复加载整个应用。带内容哈希的 `/assets/` 文件可由浏览器长期缓存；`index.html` 使用协商缓存。反向代理不应覆盖这些响应头，也不要缓存管理员 API 响应。更多限流和性能说明见 [`operations.md`](operations.md)。

系统配置页底部提供“恢复出厂设置”。该操作会清空数据库记录、管理员账号、运行配置、题库配置和自定义 Logo，并返回新的部署令牌，然后回到首次部署流程。执行前请先备份 `backend/data`。

## 持久化与备份

默认需要持久化整个 `backend/data` 目录，其中包括：

```text
craft-pass.db
runtime-config.json
content-config.json
site-logo.bin
site-logo.json
app-secret.key
```

`runtime-config.json` 中的 RCON 密码依赖 `app-secret.key` 解密。只备份数据库而丢失密钥，将无法恢复 RCON 密码。

`content-config.json` 保存后台自定义的玩家端界面文案、服规、签署声明和题库，丢失后系统会回退到内置默认内容。

生产环境也可以通过 `APP_SECRET` 环境变量提供至少 32 位的密钥材料。使用该方式时必须安全备份环境变量，并避免同时在多台实例上配置不同值。

## 安全提醒

- 首次部署时不要在完成初始化前将网站长期暴露到公网。
- 不要把部署令牌、管理员密码、RCON 密码提交到 Git。
- Minecraft RCON 端口应只允许 Craft Pass 后端服务器访问。
- 生产环境必须使用 HTTPS。
