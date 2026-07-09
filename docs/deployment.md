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

`npm start` 会自动构建最新的前端和后端并启动单端口服务。网页和 API 均由 `http://localhost:3000` 提供，不需要另行运行前端开发服务器。数据库迁移只在首次 `npm run setup` 或手动执行 `npm run deploy` 时运行。

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

`npm start` 会自动构建最新代码，再启动单端口服务。网页和 API 都由 `http://localhost:3000` 提供。

如果只是开发调试，也可以分别启动前后端：

```bash
npm run dev:backend
npm run dev:frontend
```

开发模式网页地址为 `http://localhost:5173`，`http://localhost:3000` 是后端 API；两个命令需要在两个终端中同时保持运行。

后端发现数据库中没有管理员时，会在控制台显示一次性部署令牌。

## 4. 打开部署向导

访问：

```text
http://localhost:3000/setup
```

开发模式下则访问 `http://localhost:5173/setup`。也可以直接访问对应模式的首页；未初始化时系统会自动跳转至部署向导。

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

完成初始化后，可以在 `/admin/settings` 修改站点名称、RCON 主机、端口、密码、超时和白名单命令。新设置会立即用于后续操作，无需重启后端。

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
