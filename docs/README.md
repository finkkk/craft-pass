# 项目文档

该目录存放 Craft Pass 的长期项目文档：

- `api.md`：玩家端及管理员端接口约定
- `database.md`：SQLite 数据模型、索引和迁移说明
- `deployment.md`：一键部署、持久化、备份与安全提醒
- `docker-deployment.md`：Ubuntu Docker Compose、Caddy HTTPS、更新与备份
- `operations.md`：性能、限流、缓存、故障排查与日常运维
- `release-status.md`：核心版本完成范围与发布前外部检查

建议首次部署依次阅读 `deployment.md` 和 `operations.md`；开发接口或自动化脚本时再查阅 `api.md` 与 `database.md`。
