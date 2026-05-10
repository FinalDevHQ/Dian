# Dianbot (TS + React) 架构文档

## 项目目标

- 使用 `TypeScript` 重写原 Python 核心，保持多机器人、插件热重载、模块扩展、Web 管理面板能力。
- 使用 `React` 重写现有 Web 面板，保留实时日志、配置管理、插件管理、统计分析等能力。
- 架构优先考虑：类型安全、模块解耦、可观测性、可扩展性、易部署。

---

## 总体架构

采用 Monorepo + 前后端分离：

```text
Dianbot/
├─ apps/
│  ├─ server/                 # Node.js 机器人核心服务 (TS)
│  └─ web/                    # React 管理面板
├─ packages/
│  ├─ shared/                 # 前后端共享类型与常量
│  ├─ sdk/                    # QQ OpenAPI / 网关封装
│  ├─ plugin-runtime/         # 插件运行时与装饰器
│  ├─ module-runtime/         # 模块生命周期与 Hook 系统
│  ├─ config/                 # 配置读取、校验、热加载
│  ├─ logger/                 # 日志抽象与输出
│  └─ storage/                # 数据访问层 (SQLite/MySQL/Redis)
├─ plugins/                   # 业务插件目录
├─ modules/                   # 扩展模块目录
├─ config/                    # YAML/JSON 配置文件
└─ data/                      # 运行时数据、日志、缓存
```

---

## 技术选型

### 后端 (TypeScript)

- 运行时：`Node.js 20+`
- 框架：`Fastify`（高性能、插件化、类型支持好）
- WebSocket：`ws`（用于 QQ 网关连接）
- HTTP 客户端：`undici` 或 `axios`
- 配置：`js-yaml` + `zod`（解析 + 校验）
- 日志：`pino`
- 定时任务：`node-cron`
- 文件监听：`chokidar`
- 数据库：
  - 默认日志/轻量存储：`SQLite`（`better-sqlite3`）
  - 可选业务存储：`MySQL`（`mysql2`）
  - 可选缓存：`Redis`（`ioredis`）
- 安全加密：Node `crypto`（Ed25519 签名验证）

### 前端 (React)

- 框架：`React 18` + `TypeScript`
- 构建：`Vite`
- 路由：`React Router`
- 状态管理：`Zustand`
- 数据请求：`TanStack Query`
- UI：`Ant Design` 或 `Mantine`（二选一保持统一）
- 实时通信：原生 `WebSocket` + `EventSource(SSE)` 兜底

---

## 分层设计

### 1) 接入层 (Transport Layer)

- `WebhookController`
  - 接收 QQ 回调
  - 验签（Ed25519）
  - 转换为统一事件对象 `BotEvent`
- `GatewayClient`
  - 连接 QQ WebSocket 网关
  - 实现 Hello / Identify / Resume / Heartbeat / Reconnect
  - 断线重连与会话恢复

### 2) 应用层 (Application Layer)

- `BotManager`
  - 多机器人生命周期管理（启动、停止、重连）
  - 配置热更新时动态增删实例
- `EventDispatcher`
  - 去重、分类、路由事件
  - 将事件下发到插件系统和系统处理器
- `MessageService`
  - 统一回复/主动发送/撤回/媒体消息
  - before/after Hook 管道

### 3) 领域层 (Domain Layer)

- `PluginManager`
  - 插件发现、加载、卸载、热重载
  - 权限/黑名单/维护模式
  - 正则匹配与优先级调度
- `ModuleManager`
  - 扩展模块 `setup/teardown`
  - 依赖检查与状态持久化
- `HookBus`
  - `emit` 广播模型
  - `pipeline` 管道模型

### 4) 基础设施层 (Infrastructure Layer)

- `ConfigService`：配置加载、Schema 校验、变更监听
- `LogService`：结构化日志、分流存储、实时推送
- `StorageService`：SQLite 分库、MySQL/Redis 适配
- `AuthService`：Web 面板鉴权、会话、IP 限制

---

## 关键模块设计

### BotManager

职责：

- 读取 `config/bot.yaml` 初始化多个 `BotInstance`
- 每个实例持有独立 Token、Gateway、Sender、LogContext
- 配置变更时执行增量更新（新增机器人、删除机器人、刷新配置）

核心接口示例：

```ts
interface BotManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  reloadConfig(): Promise<void>;
  getBot(appId: string): BotInstance | undefined;
}
```

### PluginManager

能力：

- 支持两类插件：
  - 单文件/轻量插件
  - 目录化插件（`main.ts` + `app/`）
- 插件生命周期：`onLoad`, `onUnload`
- 装饰器模式：`@handler`, `@interceptor`
- 文件变动监听热重载（按插件粒度重载）

### MessageService

能力：

- 回复消息：`reply(event, payload)`
- 主动消息：`sendToGroup`, `sendToUser`, `sendToChannel`
- 媒体发送：图片/语音/视频/文件
- 自动撤回与失败重试
- 统一错误映射（token 过期、限流、权限错误）

---

## 事件流设计

### 启动流程

```text
main.ts
  -> ConfigService.init()
  -> Logger.init()
  -> FastifyServer.start()
  -> ModuleManager.discoverAndStart()
  -> PluginManager.loadAll()
  -> BotManager.startAll()
  -> Scheduler.start()
```

### 消息处理流程

```text
QQ Webhook / QQ Gateway
  -> EventFactory.parse()
  -> EventDispatcher.dispatch()
      -> DedupService.check()
      -> SystemHandlers.handleLifecycle()
      -> LogService.writeMessageLog()
      -> PluginManager.dispatch()
```

### 消息发送流程

```text
Plugin Handler
  -> MessageService.reply()
      -> TemplateService.render()
      -> HookBus.pipeline("beforeSend")
      -> QQ OpenAPI send
      -> HookBus.emit("afterSend")
      -> LogService.writeSendLog()
```

---

## Web 管理面板 (React) 架构

### 页面建议

- 登录页（密码 + 会话）
- 仪表盘（机器人状态、系统资源、在线统计）
- 日志中心（检索、过滤、实时流）
- 插件管理（启停、重载、上传、编辑）
- 模块管理（启停、依赖状态）
- 配置中心（YAML 可视化编辑）
- 消息调试台（向群/用户发送测试消息）

### 前端分层

- `app/`：应用入口、路由
- `features/`：按业务拆分（bots/plugins/logs/config）
- `entities/`：领域实体（bot/plugin/log/event）
- `shared/`：UI 组件、hooks、utils

### 实时能力

- 主通道：WebSocket（日志、状态、告警）
- 兜底通道：SSE
- 前端使用 `TanStack Query` + WS 事件同步 cache

---

## 配置与环境

建议保留与原项目接近的配置结构：

```text
config/
  settings.yaml
  bot.yaml
  templates.yaml
```

校验策略：

- 启动时使用 `zod` 强校验（失败即阻止启动）
- 运行时热更新采用“先校验后替换”
- 配置变更通过事件总线通知 BotManager / PluginManager

---

## 存储设计

- 日志存储（默认）：SQLite
  - 分 appId / 日期 / 类型分表或分库
- 业务存储（可选）：MySQL
- 缓存与会话（可选）：Redis

建议抽象统一存储接口：

```ts
interface LogRepository {
  write(entry: LogEntry): Promise<void>;
  query(params: QueryParams): Promise<LogEntry[]>;
  cleanup(retentionDays: number): Promise<void>;
}
```

---

## 安全设计

- Webhook 回调：Ed25519 验签
- 管理面板：
  - 登录失败限速与 IP 封禁
  - HttpOnly + Secure Cookie / JWT 二选一
  - CSRF 防护（若使用 Cookie Session）
- 配置脱敏：前端展示时隐藏 `secret/token`
- 审计日志：关键操作记录（登录、配置变更、插件安装）

---

## 可观测性

- 结构化日志（pino）
- 健康检查：`/health`
- 指标：机器人在线数、消息吞吐、发送失败率、重连次数
- 告警：连续鉴权失败、网关重连风暴、磁盘空间不足

---

## 部署方案

### 本地开发

- `npm install`（在 `packages/` 目录下执行，使用 npm workspaces）
- `npm run dev`（启动全包 `tsc -b --watch` 增量编译）

### 生产部署

- 单机：`Docker Compose`（server + web + redis + mysql 可选）
- 进程管理：`pm2`（非容器场景）
- 反向代理：`Nginx`（TLS、静态资源缓存、WebSocket 透传）

---

## 渐进式迁移策略（推荐）

1. 先重写 Web 面板（React）并复用现有 Python API。
2. 再重写网关与消息发送核心（TS server）。
3. 最后迁移插件运行时与模块系统。

这样可以降低一次性重写风险，并保证持续可用。

---

## 结论

`TS + React` 重写该框架可行性高，且长期维护性更好（类型安全、前后端协同、生态一致）。

重点难点在于：

- QQ 网关协议稳定实现（重连、恢复、心跳）
- 插件热重载与隔离机制
- 高并发下日志与消息链路的稳定性

只要按分层架构和渐进迁移路线推进，项目可以稳定落地。
