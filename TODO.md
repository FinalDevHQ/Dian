# ElainaBot v3 — TODO

## 基础设施层 (packages/)

### @dian/shared
- [x] 共享类型定义（`BotEvent`, `ActionResult`, `OneBotRawEvent` 等）

### @dian/sdk
- [x] `OneBotAdapter` — 统一门面（Facade）
- [x] `OneBotWsClient` — WebSocket 连接、心跳、断线重连
- [x] `OneBotHttpClient` — HTTP API 调用
- [x] `OneBotAdapterConfig` 类型定义

### @dian/config
- [x] `ConfigLoader` — YAML 文件读取与解析
- [x] `ConfigSchema` — zod 校验 Schema
- [x] `ConfigService` — 配置热重载（chokidar 监听 + EventEmitter）

### @dian/logger
- [x] `LogService` — pino 结构化日志封装

### @dian/storage
- [x] 统一存储接口类型定义
- [x] `SqliteAdapter` — SQLite 适配器（better-sqlite3）
- [x] `MysqlAdapter` — MySQL 适配器（mysql2）
- [x] `RedisAdapter` — Redis 适配器（ioredis）
- [x] `StorageService` — 统一门面

### @dian/plugin-runtime
- [x] `@handler` / `@interceptor` 装饰器
- [x] `PluginManager` — 插件发现、加载、卸载骨架
- [ ] 插件热重载（chokidar 监听文件变动）
- [ ] 插件权限 / 黑名单 / 维护模式
- [ ] 正则匹配与优先级调度

### @dian/module-runtime
- [x] `Module` 接口定义
- [x] `HookBus` — 广播（emit）+ 管道（pipeline）模型
- [ ] `ModuleManager` — 模块发现、`setup/teardown`、依赖检查

---

## 应用层 (apps/server/)

- [ ] 项目脚手架（`package.json` / `tsconfig.json` / 入口 `main.ts`）
- [ ] `FastifyServer` — HTTP 服务器启动
- [ ] `WebhookController` — 接收 QQ 回调 + Ed25519 验签
- [ ] `BotManager` — 多机器人生命周期管理
- [ ] `EventDispatcher` — 事件去重、分类、路由
- [ ] `MessageService` — 统一消息回复/发送/撤回
- [ ] `TemplateService` — 消息模板渲染
- [ ] `AuthService` — Web 面板鉴权、会话、IP 限制
- [ ] `Scheduler` — node-cron 定时任务
- [ ] 启动流程串联（ConfigService → Logger → Fastify → Modules → Plugins → Bots）

---

## Web 管理面板 (apps/web/)

- [ ] 项目脚手架（Vite + React + TypeScript）
- [ ] 登录页（密码 + 会话）
- [ ] 仪表盘（机器人状态、系统资源、在线统计）
- [ ] 日志中心（检索、过滤、实时流）
- [ ] 插件管理（启停、重载、上传）
- [ ] 模块管理（启停、依赖状态）
- [ ] 配置中心（YAML 可视化编辑）
- [ ] 消息调试台（向群/用户发送测试消息）
- [ ] WebSocket 实时通道（日志、状态、告警）

---

## 目录结构

- [x] `config/` — `bot.yaml` / `settings.yaml` / `templates.yaml`
- [ ] `plugins/` — 业务插件目录
- [ ] `modules/` — 扩展模块目录
- [ ] `data/` — 运行时数据、日志、缓存
- [x] `test/` — 测试脚本

---

## 工程化

- [x] npm workspaces Monorepo 结构
- [x] TypeScript Project References 增量构建
- [x] `tsconfig.base.json` 共享编译配置
- [x] 各包 `@types/node` 配置修复
- [ ] `.gitignore` 补充 `dist/` / `data/` / `.env`
- [ ] ESLint + Prettier 配置
- [ ] 单元测试框架（vitest）
- [ ] Docker Compose 部署配置
- [ ] CI/CD（GitHub Actions）
