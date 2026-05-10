# Dian v3 — TODO

## 基础设施层 (packages/)

### @dian/shared
- [x] 共享类型定义（`BotEvent`, `ActionResult`, `OneBotRawEvent` 等）

### @dian/sdk
- [x] `OneBotAdapter` — 统一门面（Facade）
- [x] `OneBotWsClient` — WebSocket 连接、心跳、断线重连
- [x] `OneBotHttpClient` — HTTP API 调用（含差异化重试策略）
- [x] `OneBotAdapterConfig` 类型定义

### @dian/config
- [x] `ConfigLoader` — YAML 文件读取与解析
- [x] `ConfigSchema` — zod 校验 Schema（含 superRefine 条件校验）
- [x] `ConfigService` — 配置热重载（chokidar 监听 + EventEmitter）
- [x] `ConfigWriter` — YAML 写入工具
- [x] `redact()` — 配置脱敏（隐藏 token/secret）

### @dian/logger
- [x] `LogService` — pino 结构化日志封装
- [x] `ChildLogger` — 子日志上下文绑定

### @dian/storage
- [x] 统一存储接口类型定义（`LogRepository` / `CacheRepository`）
- [x] `SqliteAdapter` — SQLite 适配器（better-sqlite3，WAL 模式，自动建表）
- [x] `MysqlAdapter` — MySQL 适配器（mysql2 连接池）
- [x] `RedisAdapter` — Redis 适配器（ioredis，lazyConnect）
- [x] `StorageService` — 统一门面（优先级选择 + 多源管理）

### @dian/plugin-runtime
- [x] `@Plugin` / `@Handler` / `@Interceptor` 装饰器
- [x] `PluginManager` — 插件发现、加载、卸载
- [x] 插件热重载（chokidar 监听文件变动，按插件粒度重载）
- [x] 插件黑名单 / 维护模式（`addToBlacklist` / `removeFromBlacklist`）
- [x] 正则 / 字符串 / 函数三种 pattern 匹配与优先级调度
- [x] Bot 作用域白名单（默认拒绝，`setPluginBots` / `bulkSetPluginBots`）
- [x] `PluginSetupContext` — 插件路由 / 指令 / UI 注册接口

### @dian/module-runtime
- [x] `Module` 接口定义
- [x] `HookBus` — 广播（emit / allSettled）+ 管道（pipeline）模型
- [x] `ModuleManager` — 模块发现、`setup/teardown`、依赖检查、逆序停止

---

## 应用层 (apps/server/)

- [x] 项目脚手架（`package.json` / `tsconfig.json` / 入口 `main.ts`）
- [x] `FastifyServer` — HTTP 服务器启动（CORS / 静态资源 / WebSocket 插件）
- [x] `BotManager` — 多机器人生命周期管理（启动 / 停止 / reloadConfig）
- [x] `BotInstance` — 单机器人实例（适配器封装 + 错误隔离）
- [x] `EventBus` — 环形缓冲事件历史 + 订阅/取消订阅
- [x] `EventDispatcher` — 事件去重（LRU 上限 2000）、路由、reply 构建
- [x] `LogBridge` — 日志持久化镜像（原型链 patch，fire-and-forget）
- [x] `DatabaseExplorer` — SQLite schema 自省 + 受限 SQL 执行（只读模式，1000 行上限）
- [x] `PluginScopeIO` — bot 白名单持久化到 `plugin-scope.json`
- [x] 启动流程串联（ConfigService → Logger → Storage → Plugins → EventBus → BotManager）
- [x] 优雅关机（SIGINT / SIGTERM）
- [ ] `WebhookController` — 接收 QQ 回调 + Ed25519 验签
- [ ] `MessageService` — 统一消息回复/发送/撤回（含 Hook 管道）
- [ ] `TemplateService` — 消息模板渲染（`templates.yaml`）
- [ ] `AuthService` — Web 面板鉴权（JWT/Cookie + IP 限速 + 审计日志）
- [ ] `Scheduler` — node-cron 定时任务

### API 路由

- [x] `GET /health` / `GET /status` — 健康检查与机器人状态
- [x] `GET /system` — 系统资源（CPU 采样 / 内存 / Node / OS）
- [x] `GET /config/files` / `GET|PUT /config/files/:name` / `POST /config/format` — 配置文件管理（路径安全校验）
- [x] `POST|DELETE /bots` / `PUT /bots/:botId/enabled` — 机器人 CRUD
- [x] `GET /plugins` / `PUT /plugins/:name/enabled` / `PUT /plugins/:name/bots` / `DELETE /plugins/:name` — 插件管理
- [x] `POST /plugins/upload` — ZIP 安装（fflate，跨平台）
- [x] `/plugins/:name/api/*` — 插件 API catch-all（热插拔安全）
- [x] `/plugins/:name/ui/*` — 插件静态 UI（目录穿越防护）
- [x] `GET /db/sources` / 表结构 / `POST /db/sources/:name/query` — 数据库浏览
- [x] `GET /events/recent` / `GET /events/stream` — 事件查询与 SSE 实时流

---

## Web 管理面板 (apps/web/)

- [x] 项目脚手架（Vite + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui）
- [x] 仪表盘（机器人状态/启停/新增删除、系统资源、CPU/内存图表）
- [x] 日志中心（SSE 实时流、消息段渲染、事件类型过滤、自动滚动/暂停）
- [x] 插件管理（启停、Bot 白名单编辑、ZIP 上传拖拽、插件 UI iframe 嵌入）
- [x] 配置中心（YAML 可视化编辑、格式化、脏检测、保存状态徽章）
- [x] 数据库浏览器（数据源 / 表 / Schema / SQL 执行 / CSV 导出）
- [x] `BotScopeSwitcher` — 全局 Bot 视角筛选器
- [ ] 登录页（密码 + 会话，依赖 AuthService）
- [ ] 模块管理（启停、依赖状态，依赖 ModuleManager HTTP 接口）
- [ ] 消息调试台（向群/用户发送测试消息，依赖 MessageService）
- [ ] WebSocket 实时通道（当前为 SSE，WS 双向通道待实现）

---

## 插件模板 (plugin-template/)

- [x] `ping-pong` 示例插件（装饰器 / 动态指令 / API 路由 / React UI）
- [x] tsup 构建（ESM，捆绑 reflect-metadata）
- [x] Vite 构建 UI（React 19 + Tailwind 4，暗色主题）
- [x] `scripts/pack.mjs` — ZIP 打包脚本（fflate，跨平台）
- [x] 插件开发 README（12 节完整手册）

---

## 目录结构

- [x] `config/` — `bot.yaml` / `settings.yaml` / `templates.yaml`
- [x] `plugins/` — 业务插件目录（ping-pong 已就绪）
- [x] `data/` — 运行时数据（SQLite DB 已生成）
- [x] `test/` — 测试脚本
- [ ] `modules/` — 扩展模块目录（ModuleManager 已就绪，目录待创建）

---

## 工程化

- [x] npm workspaces Monorepo 结构
- [x] TypeScript Project References 增量构建
- [x] `tsconfig.base.json` 共享编译配置
- [x] `@types/node` 配置修复
- [x] `.gitignore`（含 `dist/` / `data/` / `.env`）
- [x] ZIP 安装/打包跨平台（fflate 替换 PowerShell）
- [ ] ESLint + Prettier 配置
- [ ] 单元测试框架（vitest）
- [ ] Docker Compose 部署配置
- [ ] CI/CD（GitHub Actions）

---

## 安全待办

- [ ] `config/bot.yaml` 中的 accessToken 移出 git（改用 `.env` 或 git-crypt）
- [ ] Admin API 添加鉴权中间件（依赖 AuthService）
