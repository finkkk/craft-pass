# Craft Pass

Craft Pass 是一个面向 Minecraft 服务器的入服审核与白名单管理系统。

玩家需要填写 QQ 号和 Minecraft ID、阅读服务器规则并完成答题。答题通过后申请进入管理员后台，管理员审核通过时可通过 RCON 自动执行白名单命令。

## 主要功能

- 玩家资料填写、服规阅读、协议签署和单选题测试
- 后端独立校验与判分，不向玩家端泄露正确答案
- 管理员登录、申请分类、详情查看、修改和删除
- 审核通过、拒绝、RCON 执行记录和失败重试
- 自定义站点名称、Logo、玩家端界面文案、服规、协议版本、题库和合格分数
- 后台配置 RCON 地址、密码、端口和命令模板
- 申请量、通过率、状态分布和最近趋势统计
- 首次部署网页向导、操作日志、限流和敏感配置加密

## 快速部署

准备环境：

- Node.js 22.12.0 或更高版本
- npm
- 可选：已经开启白名单和 RCON 的 Minecraft 服务端

在项目根目录执行：

```bash
npm run setup
```

该命令会自动安装依赖、构建前后端、执行数据库迁移并启动服务。

保持命令窗口运行，然后打开控制台显示的部署地址：

```text
http://localhost:3000/setup
```

输入控制台中的一次性部署令牌，在网页中填写站点、管理员和可选的 RCON 配置即可。

首次部署完成后，日常启动使用：

```bash
npm start
```

`npm start` 会自动构建最新的前端和后端，然后由后端在同一个 `3000` 端口提供前端网页与 API。不需要再运行 `npm run dev:frontend`，也不会在日常启动时重复迁移数据库。

如果只想生成生产构建并执行迁移，但暂时不启动：

```bash
npm run deploy
```

更新代码或数据库结构后应先运行一次 `npm run deploy`。日常停止后重新启动只需要 `npm start`，不会重复迁移数据库。

## 使用入口

- 玩家申请：`http://localhost:3000/`
- 管理后台：`http://localhost:3000/admin`
- 数据统计：`http://localhost:3000/admin/statistics`
- 题库、服规与玩家端文案：`http://localhost:3000/admin/content`
- 系统配置：`http://localhost:3000/admin/settings`

RCON 可以在首次部署时暂时关闭，之后再从系统配置页面启用。未启用 RCON 时仍可查看、管理和拒绝申请，但不能执行白名单批准操作。

## 数据与备份

数据库、运行配置、题库和加密密钥默认保存在：

```text
backend/data
```

请完整备份该目录。公网部署时还应配置 HTTPS，并限制 Minecraft RCON 端口只允许 Craft Pass 后端访问。

## 开发与检查

只有进行源码开发、需要前端热更新时，才需要分别在两个终端运行：

```bash
npm run dev:backend
npm run dev:frontend
```

开发模式访问 `http://localhost:5173`；此时 `3000` 端口主要提供后端 API。

检查命令：

```bash
npm test
npm run typecheck
npm run build
```

更多说明见 [`docs`](docs/README.md)。
