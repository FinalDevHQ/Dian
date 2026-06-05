# Dian 框架缺陷报告

> 审查日期：2026-06-05
> 审查范围：全量源码（packages/\*、apps/server/\*、apps/web/\*）

---

## 严重 (Critical)

### 1. SqlitePluginStore 存在 SQL 注入风险

**文件**: [sqlite-plugin-store.ts](packages/storage/src/sqlite-plugin-store.ts)

`createTable`、`insert`、`query`、`delete`、`dropPluginTables` 等方法直接将表名和列名拼接进 SQL 字符串，未做任何转义或参数化处理。恶意插件名或表名可注入任意 SQL。

```ts
// createTable — tableName 直接拼入 DDL
this.db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (...)`);

// insert — tableName 和 keys 直接拼入
this.db.prepare(`INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`);

// query — orderBy 来自外部参数，可注入
sql += ` ORDER BY ${options.orderBy} ${options.order || "DESC"}`;

// delete — 同 insert 的问题
this.db.prepare(`DELETE FROM ${tableName} ...`);

// dropPluginTables — 直接 DROP
this.db.exec(`DROP TABLE IF EXISTS ${table}`);
```

**建议**: 对表名/列名做白名单校验（仅允许 `[a-zA-Z0-9_]`），或使用双引号转义。`orderBy` 应限定为已知列名。

---

### 2. DatabaseExplorer SQL 注入（db query 路由）

**文件**: [explorer.ts](apps/server/src/db/explorer.ts) → [db.ts](apps/server/src/routes/db.ts)

`POST /db/sources/:name/query` 接受用户提交的任意 SQL 并直接执行。虽然默认 `readOnly=true`，但前端可以传 `readOnly: false` 执行任意写操作（`DROP TABLE`、`DELETE` 等）。这是有意设计的功能，但缺少任何额外的安全层（如 SQL 语句类型白名单、行数限制已存在但可被绕过）。

**建议**: 考虑增加写操作确认机制或仅在开发模式下开放写入。

---

### 3. EventDispatcher 硬编码插件专属表名到框架核心

**文件**: [event-dispatcher.ts](apps/server/src/event/event-dispatcher.ts:80-95, 120-135)

框架核心代码中硬编码了 `qq_group_admin_bot_messages` 这个属于特定插件的表名。当 reply 或 sendAction 成功时，框架会自动向该表写入数据。这破坏了框架与插件的边界：

```ts
// 硬编码插件表名
this.ensureTable("qq_group_admin_bot_messages", [...])
```

**建议**: 将消息持久化逻辑移至对应插件内部，或通过事件回调让插件自行决定是否存储。

---

## 高 (High)

### 4. 默认密码哈希硬编码在源码中

**文件**: [loader.ts](packages/config/src/loader.ts:22)

`DEFAULT_SETTINGS` 包含一个 bcrypt 哈希值，对应密码 `change_me`。首次启动时会自动写入 `settings.yaml`。虽然文档说明了这一点，但源码中硬编码哈希仍是安全隐患——攻击者可以直接用此密码登录未修改默认密码的实例。

**建议**: 首次启动时自动生成随机密码并打印到控制台，强制用户修改。

---

### 5. 认证端点无速率限制

**文件**: [auth.ts](apps/server/src/routes/auth.ts)

`POST /auth/login` 没有任何速率限制或账户锁定机制，攻击者可以无限制尝试密码（暴力破解）。

**建议**: 引入速率限制中间件（如 `@fastify/rate-limit`），或实现基于 IP 的失败次数计数与临时封禁。

---

### 6. CORS 完全开放

**文件**: [fastify.ts](apps/server/src/server/fastify.ts:63)

```ts
await app.register(cors, { origin: true });
```

`origin: true` 允许任意来源跨域请求。在生产环境中，任何网站都可以向 API 发送请求（配合默认密码，可直接接管系统）。

**建议**: 生产环境应限制为部署域名，或至少通过配置文件控制允许的 origin。

---

### 7. YAML 解析无安全防护

**文件**: [writer.ts](packages/config/src/writer.ts:3)、[config.ts](apps/server/src/routes/config.ts:103)

`js-yaml.load()` 默认支持 YAML 1.1 的所有特性，包括 `!!js/function` 等危险标签，可执行任意代码。`POST /config/format` 接口直接将用户输入传给 `parseYaml()`。

**建议**: 使用 `yaml.load(text, { schema: yaml.DEFAULT_SCHEMA })` 并禁用自定义类型，或迁移到更安全的 `yaml`（js-yaml 的维护者推荐的替代库）。

---

## 中 (Medium)

### 8. 前端文档声称"多 Bot 管理"，实际仅支持单 Bot

**文件**: [schema.ts](packages/config/src/schema.ts:73)、[bot-service.ts](apps/server/src/src/bot/bot-service.ts)

README 开头写明"多 Bot 管理 — 同时连接多个 OneBot 实例"，但：
- `BotConfigSchema` 顶层是 `z.object({ bot: BotEntrySchema })`，只允许单个 bot
- `BotService` 只管理一个 `BotInstance`
- `ConfigService.bot` 返回单个 `BotEntry`

这是文档与实现的严重不一致。

**建议**: 要么实现多 bot 支持（将 schema 改为 `z.object({ bots: z.array(BotEntrySchema) })`），要么修正文档。

---

### 9. 模块加载器不支持目录型模块

**文件**: [ModuleManager.ts](packages/module-runtime/src/manager/ModuleManager.ts:42-48)

`discoverAndStart` 对目录条目直接执行 `import(fullPath)`，但 Node.js 无法 import 一个目录（需要 `index.js`）。与 `PluginLoader.scanDir` 不同，这里缺少对 `resolve(fullPath, "index.js")` 的处理。

```ts
// 直接 import 目录会失败
const imported = (await import(fullPath)) as Record<string, unknown>;
```

**建议**: 对无扩展名的条目检查 `index.js` 是否存在，与 PluginLoader 保持一致。

---

### 10. SSE Token 暴露在 URL 查询参数中

**文件**: [middleware.ts](apps/server/src/auth/middleware.ts:42-44)、[api.ts](apps/web/src/lib/api.ts:261)

SSE 连接通过 `?token=xxx` 传递 JWT。Token 会出现在：
- 服务器访问日志
- 浏览器历史记录
- 代理服务器日志
- Referer 头

**建议**: SSE 连接建立后通过第一条消息进行认证，或使用短期一次性 token。

---

### 11. 日志持久化通过原型猴子补丁实现

**文件**: [log-bridge.ts](apps/server/src/log-bridge.ts:38-55)

`installLogPersistence` 直接修改 `ChildLogger.prototype` 上的方法，这会影响所有已创建和未来创建的 ChildLogger 实例。这种模式：
- 不可组合（多个补丁会互相覆盖）
- 难以调试
- 卸载时可能遗漏某些实例

**建议**: 改用装饰器模式或事件发射机制，在 LogService 内部支持持久化回调。

---

### 12. 配置文件并发写入无锁保护

**文件**: [bots.ts](apps/server/src/routes/bots.ts)、[config.ts](apps/server/src/routes/config.ts)

多个 API 请求同时修改 `bot.yaml` 或 `settings.yaml` 时存在竞态条件：
1. 请求 A 读取 bot.yaml
2. 请求 B 读取 bot.yaml
3. 请求 A 写入修改
4. 请求 B 基于旧值写入覆盖 A 的修改

**建议**: 引入文件写入锁（如 `proper-lockfile`），或将配置修改序列化到内存队列。

---

### 13. WS 重连使用固定间隔，无指数退避

**文件**: [ws-client.ts](packages/sdk/src/onebot/ws-client.ts:169-182)

重连间隔始终为 `reconnectIntervalMs`（默认 5 秒），不做递增。当 OneBot 服务长时间不可用时，会产生大量无效重连请求。多 bot 场景下还可能引发"惊群效应"。

**建议**: 采用指数退避策略（如 5s → 10s → 20s → 60s），连接成功后重置。

---

### 14. 前端无 Error Boundary

**文件**: [App.tsx](apps/web/src/App.tsx)

React 应用没有设置 Error Boundary。任何组件渲染异常都会导致整个白屏，用户只能刷新页面。

**建议**: 在路由层级添加 Error Boundary，捕获渲染错误并展示友好提示。

---

### 15. 数据库无 Schema 版本管理

**文件**: [sqlite.ts](packages/storage/src/sqlite.ts)、[sqlite-messages.ts](packages/storage/src/sqlite-messages.ts)

所有迁移使用 `CREATE TABLE IF NOT EXISTS`，无法处理表结构变更（如新增列、修改索引）。升级后需要手动处理 schema 变更。

**建议**: 引入版本号管理（如 `PRAGMA user_version`），按版本执行增量迁移。

---

### 16. 日志清理从未被调用

**文件**: [types.ts](packages/storage/src/types.ts:16)、[sqlite.ts](packages/storage/src/sqlite.ts:67)

`LogRepository` 定义了 `cleanup(retentionDays)` 方法，`SqliteLogRepository` 也实现了它，但整个代码库中没有任何地方调用此方法。日志会无限增长。

**建议**: 在 `main.ts` 中注册定时任务（如每天凌晨执行），或在启动时执行一次清理。

---

## 低 (Low)

### 17. 根目录 dev 脚本跨平台兼容性问题

**文件**: [package.json](package.json:11)

```json
"dev": "npm run dev -w packages & npm run dev -w apps/server"
```

`&` 是 Unix shell 的后台运行符，在 Windows 的 cmd/PowerShell 中行为不同。

**建议**: 使用 `concurrently` 或 `npm-run-all` 等跨平台工具。

---

### 18. bodyLimit 设置过大

**文件**: [fastify.ts](apps/server/src/server/fastify.ts:62)

```ts
const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 }); // 50 MB
```

50MB 的 body limit 对于 bot 管理 API 来说过大，可能被用于内存耗尽攻击。虽然插件 ZIP 上传需要较大 body，但应限制到特定路由。

**建议**: 全局设为合理值（如 1MB），仅 `/plugins/upload` 路由覆盖为更大值。

---

### 19. 插件 UI 静态文件缺少安全响应头

**文件**: [plugins.ts](apps/server/src/routes/plugins.ts:310-320)

静态文件服务缺少以下安全头：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy`

**建议**: 添加安全响应头，防止 MIME 嗅探和点击劫持。

---

### 20. PluginStore 接口缺少 update 方法

**文件**: [decorators.ts](packages/plugin-runtime/src/decorators.ts:16-40)

`PluginStore` 接口只有 `createTable`、`insert`、`query`、`delete`，缺少 `update` 方法。插件如需更新记录，必须先 delete 再 insert，无法保证原子性。

**建议**: 添加 `update(tableName, params, data)` 方法。

---

### 21. 前端 401 处理可能导致多次页面刷新

**文件**: [api.ts](apps/web/src/lib/api.ts:53-56)

```ts
if (res.status === 401) {
  clearToken()
  window.location.reload()
}
```

当多个并发请求同时收到 401 时，会触发多次 `window.location.reload()`。

**建议**: 使用标志位确保只刷新一次，或改用 React Router 的导航守卫统一处理。

---

### 22. ProxyFetch 返回类型不一致

**文件**: [proxy-fetch.ts](apps/server/src/utils/proxy-fetch.ts:28-34)

有代理时返回 `undici` 的 `Response`（通过 `as unknown as Response` 强转），无代理时返回 `globalThis.fetch` 的原生 `Response`。两者在某些边缘情况下行为可能不同。

**建议**: 统一使用 `undici` 的 `fetch`，无论是否配置代理。

---

### 23. EventBus 历史清理使用 splice 效率较低

**文件**: [event-bus.ts](apps/server/src/event/event-bus.ts:33-35)

```ts
this.history.splice(0, this.history.length - this.maxHistory);
```

每次超出限制时 `splice` 移除前面的元素，会导致数组重新分配。环形缓冲区（ring buffer）更高效。

**建议**: 使用固定大小的数组 + 索引指针实现环形缓冲区。

---

### 24. EventDispatcher 的 seen Set 清理逻辑有隐患

**文件**: [event-dispatcher.ts](apps/server/src/event/event-dispatcher.ts:35-39)

```ts
const iter = this.seen.values();
for (let i = 0; i < 500; i++) this.seen.delete(iter.next().value!);
```

使用 `iter.next().value!` 非空断言，如果 Set 在迭代过程中被并发修改（虽然当前单线程不太可能），可能得到 `undefined`。此外，固定删除 500 个是硬编码的。

**建议**: 当 size 超过阈值时清空整个 Set（`this.seen.clear()`），或使用 LRU 缓存。

---

### 25. 市场插件索引无缓存

**文件**: [api.ts](apps/web/src/lib/api.ts:319)

```ts
const MARKET_INDEX_URL = "https://raw.githubusercontent.com/FinalDevHQ/Dian-plugins/main/index.json"
```

每次打开市场页面都会直接请求 GitHub raw，无本地缓存。在网络不佳时体验很差。

**建议**: 前端增加 localStorage 缓存 + 过期时间，或后端代理并缓存。

---

### 26. OneBot WS 客户端不处理二进制消息

**文件**: [ws-client.ts](packages/sdk/src/onebot/ws-client.ts:123-125)

```ts
ws.on("message", (data) => {
  this._handleMessage(data.toString());
});
```

直接调用 `data.toString()`，如果 OneBot 实现发送二进制帧（如压缩消息），会导致乱码或解析失败。

**建议**: 检查 `data` 类型，对 Buffer 做适当处理（如解压后再解析）。

---

## 总结

| 严重程度 | 数量 | 关键领域 |
|---------|------|---------|
| 严重 | 3 | SQL 注入、框架-插件边界污染 |
| 高 | 4 | 认证安全、YAML 安全、CORS |
| 中 | 9 | 文档不一致、并发安全、架构设计 |
| 低 | 10 | 跨平台兼容性、性能优化、类型安全 |

最优先应修复的是 **SQL 注入**（#1、#2）和 **YAML 解析安全**（#7），这些可被远程利用。其次是 **认证相关问题**（#4、#5、#6）。

---

*报告生成于 2026-06-05，基于 commit 当前 HEAD 的源码审查。*
