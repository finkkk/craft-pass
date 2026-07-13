# Craft Pass

> Linux / Ubuntu 生产环境推荐使用 Docker Compose。完整步骤见 [Linux / Docker Compose 部署文档](docs/docker-deployment.md)。

Craft Pass 是一个面向 Minecraft 服务器的入服审核与白名单管理系统。

玩家需要填写 QQ 号和 Minecraft ID、阅读服务器规则并完成答题。答题通过后申请进入管理员后台，管理员审核通过时可通过 RCON 自动执行白名单命令。

## 主要功能

- 玩家资料填写、服规阅读、协议签署和单选题测试
- 玩家使用 QQ 与 Minecraft ID 查看审核进度和拒绝原因
- QQ 与 Minecraft ID 全状态双向查重，防止同一身份重复或交叉绑定
- 后端独立校验与判分，不向玩家端泄露正确答案
- 管理员登录、申请分类、详情查看、修改和删除
- 审核通过、拒绝、RCON 执行记录、失败重试和返回输出查看
- 管理员多选申请并批量批准、拒绝或重试 RCON
- 自定义站点名称、Logo、玩家端界面文案、服规、协议版本、题库和合格分数
- 后台配置 RCON 地址、密码、端口和命令模板，并可发送自定义 RCON 命令
- 后台控制申请入口和同 IP 提交频率限制
- 自定义 RCON 命令开关和危险命令黑名单
- 恢复出厂设置，可清空数据并回到首次部署流程
- 可配置每次随机抽题数量，并使用签名凭证防止篡改题目范围
- 后端定期检查 GitHub Releases，发现新版本时在管理后台提醒
- 申请量、通过率、状态分布和最近趋势统计
- 首次部署网页向导、操作日志、限流和敏感配置加密
- 后台站内快速导航、前后台按需加载、配置内存缓存和静态资源长期缓存

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
http://localhost:47821/setup
```

输入控制台中的一次性部署令牌，在网页中填写站点、管理员和可选的 RCON 配置即可。

首次部署完成后，日常启动使用：

```bash
npm start
```

`npm start` 会自动构建最新的前端和后端，然后由后端在同一个 `47821` 端口提供前端网页与 API。
如果只想生成生产构建并执行迁移，但暂时不启动：

```bash
npm run deploy
```

更新代码或数据库结构后应先运行一次 `npm run deploy`。日常停止后重新启动只需要 `npm start`，不会重复迁移数据库。

## 使用入口

- 玩家申请：`http://localhost:47821/`
- 管理后台：`http://localhost:47821/admin`
- 数据统计：`http://localhost:47821/admin/statistics`
- 题库与服规：`http://localhost:47821/admin/content`
- 界面定制：`http://localhost:47821/admin/appearance`
- RCON 控制台：`http://localhost:47821/admin/rcon`
- 系统配置：`http://localhost:47821/admin/settings`

RCON 可以在首次部署时暂时关闭，之后再从系统配置页面启用。未启用或连接失败时仍可查看、管理和拒绝申请，但不能执行白名单批准操作或自定义 RCON 命令。系统配置页还可以临时关闭玩家申请入口并设置同 IP 提交频率限制。“提交统计时段”不是玩家答题限时。

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

日常部署和使用只需要访问 `http://localhost:47821`。前端开发服务器仅用于源码热更新调试，不作为普通访问入口。HTTP 端口可在系统配置页修改，保存后重启服务生效；也可在首次启动前通过后端 `PORT` 环境变量指定。

检查命令：

```bash
npm test
npm run typecheck
npm run build
```

更多说明见 [`docs`](docs/README.md)。

遇到 HTTP 429、后台加载异常或需要确认缓存/反向代理配置时，请查看 [`docs/operations.md`](docs/operations.md)。
