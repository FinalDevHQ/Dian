# OneBot 多实现适配方案

## 背景

目前 Dian 框架基于 OneBot v11 协议，主要针对 `go-cqhttp` 实现。然而社区存在多个 OneBot 实现：

- **NapCat** - 基于 NTQQ 的 OneBot 实现
- **LLOneBot** - 基于 NTQQ 的 OneBot 实现
- **SnowLuma** - 另一个 OneBot 实现
- **go-cqhttp** - 原始实现（已停止维护）

这些实现在标准 OneBot v11 协议基础上，各自有一些特有 API 和细微差异。为了支持多种实现，需要设计一套可扩展的适配方案。

## 设计目标

1. **自动识别**：能够自动检测当前使用的 OneBot 实现类型
2. **配置覆盖**：支持手动指定实现类型，覆盖自动检测
3. **策略模式**：不同实现的特有 API 通过策略模式隔离
4. **开闭原则**：新增实现只需添加策略类，无需修改核心代码
5. **渐进式**：优先支持标准 API 差异，后续扩展特有 API

## 接口差异分析

### 版本信息 API

所有实现都支持 `get_version` API，返回的 `app_name` 字段可用于识别：

```json
// NapCat
{
  "status": "ok",
  "retcode": 0,
  "data": {
    "app_name": "NapCat.Onebot",
    "app_version": "4.17.22",
    "protocol_version": "v11"
  }
}

// SnowLuma
{
  "status": "ok",
  "retcode": 0,
  "data": {
    "app_name": "SnowLuma",
    "app_version": "1.9.2-node",
    "protocol_version": "v11"
  }
}

// LLOneBot
{
  "status": "ok",
  "retcode": 0,
  "data": {
    "app_name": "LLOneBot",
    "app_version": "3.x.x",
    "protocol_version": "v11"
  }
}
```

### 特有 API 示例

不同实现可能支持一些特有 API：

| 实现 | 特有 API | 说明 |
|------|----------|------|
| NapCat | `set_group_sign` | 群签到 |
| NapCat | `get_group_honor_info` | 群荣誉信息 |
| LLOneBot | `set_msg_emoji_like` | 消息表情回应 |
| SnowLuma | 待补充 | ... |

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    OneBotAdapter                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │              StrategyFactory                     │   │
│  │  ┌─────────┬─────────┬─────────┬─────────────┐ │   │
│  │  │ NapCat  │ LLOneBot│ SnowLuma│ go-cqhttp   │ │   │
│  │  │ Strategy│ Strategy│ Strategy│ Strategy    │ │   │
│  │  └─────────┴─────────┴─────────┴─────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────┴──────────────────────┐       │
│  │           OneBotHttpClient                   │       │
│  │        (统一 HTTP 请求层)                    │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. 策略接口 (OneBotStrategy)

```typescript
// packages/sdk/src/onebot/strategy.ts

export interface OneBotStrategy {
  /** 实现名称 */
  readonly name: string;
  
  /** 
   * 获取版本信息（用于自动检测）
   * @param httpClient HTTP 客户端实例
   * @returns 版本信息对象
   */
  getVersion(httpClient: OneBotHttpClient): Promise<VersionInfo>;
  
  /**
   * 获取支持的扩展 action 列表
   * @returns 扩展 action 名称数组
   */
  getExtendedActions(): string[];
  
  /**
   * 处理扩展 action（可选）
   * 默认行为：透传给 httpClient
   * @param action action 名称
   * @param params action 参数
   * @returns 执行结果
   */
  handleExtendedAction?<T>(
    action: string, 
    params: Record<string, unknown>
  ): Promise<ActionResult<T>>;
}

export interface VersionInfo {
  appName: string;
  appVersion: string;
  protocolVersion: string;
}
```

#### 2. 策略实现

##### NapCat 策略

```typescript
// packages/sdk/src/onebot/strategies/napcat.strategy.ts

export class NapCatStrategy implements OneBotStrategy {
  readonly name = "napcat";
  
  async getVersion(httpClient: OneBotHttpClient): Promise<VersionInfo> {
    const result = await httpClient.request({ action: "get_version" });
    return result.data as VersionInfo;
  }
  
  getExtendedActions(): string[] {
    return [
      "set_group_sign",        // 群签到
      "send_group_sign",       // 群签到（别名）
      "get_group_honor_info",  // 群荣誉信息
      "get_group_system_msg",  // 群系统消息
      // ... 其他 NapCat 特有 action
    ];
  }
  
  async handleExtendedAction<T>(
    action: string,
    params: Record<string, unknown>
  ): Promise<ActionResult<T>> {
    // NapCat 特殊处理逻辑（如果有）
    // 默认透传
    return httpClient.request({ action, params });
  }
}
```

##### SnowLuma 策略

```typescript
// packages/sdk/src/onebot/strategies/snowluma.strategy.ts

export class SnowLumaStrategy implements OneBotStrategy {
  readonly name = "snowluma";
  
  async getVersion(httpClient: OneBotHttpClient): Promise<VersionInfo> {
    const result = await httpClient.request({ action: "get_version" });
    return result.data as VersionInfo;
  }
  
  getExtendedActions(): string[] {
    return [
      // SnowLuma 特有 action
    ];
  }
}
```

##### LLOneBot 策略

```typescript
// packages/sdk/src/onebot/strategies/llonebot.strategy.ts

export class LLOneBotStrategy implements OneBotStrategy {
  readonly name = "llonebot";
  
  async getVersion(httpClient: OneBotHttpClient): Promise<VersionInfo> {
    const result = await httpClient.request({ action: "get_version" });
    return result.data as VersionInfo;
  }
  
  getExtendedActions(): string[] {
    return [
      "set_msg_emoji_like",    // 消息表情回应
      "get_friends_with_group", // 获取好友分组
      // ... 其他 LLOneBot 特有 action
    ];
  }
}
```

##### 默认策略（go-cqhttp 兼容）

```typescript
// packages/sdk/src/onebot/strategies/default.strategy.ts

export class DefaultStrategy implements OneBotStrategy {
  readonly name = "go-cqhttp";
  
  async getVersion(httpClient: OneBotHttpClient): Promise<VersionInfo> {
    try {
      const result = await httpClient.request({ action: "get_version" });
      return result.data as VersionInfo;
    } catch {
      // 某些实现可能不支持 get_version
      return {
        appName: "unknown",
        appVersion: "unknown",
        protocolVersion: "v11",
      };
    }
  }
  
  getExtendedActions(): string[] {
    return []; // 无扩展 action
  }
}
```

#### 3. 策略工厂

```typescript
// packages/sdk/src/onebot/strategy-factory.ts

export class StrategyFactory {
  /** 已注册的策略映射 */
  private static strategies = new Map<string, OneBotStrategy>([
    ["napcat", new NapCatStrategy()],
    ["snowluma", new SnowLumaStrategy()],
    ["llonebot", new LLOneBotStrategy()],
    ["go-cqhttp", new DefaultStrategy()],
  ]);
  
  /**
   * 创建策略实例
   * @param implementation 实现类型，"auto" 表示自动检测
   * @param httpClient HTTP 客户端（自动检测时必须）
   * @returns 策略实例
   */
  static async create(
    implementation: string,
    httpClient?: OneBotHttpClient
  ): Promise<OneBotStrategy> {
    // 如果指定了具体实现，直接返回
    if (implementation !== "auto") {
      const strategy = this.strategies.get(implementation);
      if (!strategy) {
        console.warn(
          `[StrategyFactory] Unknown implementation "${implementation}", falling back to default`
        );
        return this.strategies.get("go-cqhttp")!;
      }
      return strategy;
    }
    
    // 自动检测
    if (!httpClient) {
      console.warn(
        `[StrategyFactory] Auto-detection requires httpClient, using default`
      );
      return this.strategies.get("go-cqhttp")!;
    }
    
    return this.detectImplementation(httpClient);
  }
  
  /**
   * 自动检测 OneBot 实现类型
   * 通过调用 get_version API 的 app_name 字段判断
   */
  private static async detectImplementation(
    httpClient: OneBotHttpClient
  ): Promise<OneBotStrategy> {
    try {
      const result = await httpClient.request({ action: "get_version" });
      const appName = (result.data?.app_name || "").toLowerCase();
      
      // 按优先级匹配
      if (appName.includes("napcat")) {
        console.info("[StrategyFactory] Detected NapCat implementation");
        return this.strategies.get("napcat")!;
      }
      
      if (appName.includes("snowluma")) {
        console.info("[StrategyFactory] Detected SnowLuma implementation");
        return this.strategies.get("snowluma")!;
      }
      
      if (appName.includes("llonebot")) {
        console.info("[StrategyFactory] Detected LLOneBot implementation");
        return this.strategies.get("llonebot")!;
      }
      
      console.info(
        `[StrategyFactory] Unknown implementation "${appName}", using default`
      );
      return this.strategies.get("go-cqhttp")!;
      
    } catch (err) {
      console.warn("[StrategyFactory] Failed to detect implementation:", err);
      return this.strategies.get("go-cqhttp")!;
    }
  }
  
  /**
   * 注册自定义策略（用于扩展）
   */
  static register(name: string, strategy: OneBotStrategy): void {
    this.strategies.set(name, strategy);
  }
}
```

#### 4. 配置扩展

```typescript
// packages/config/src/schema.ts

/** OneBot 实现类型 */
export const OneBotImplementationSchema = z.enum([
  "llonebot",
  "napcat", 
  "snowluma",
  "go-cqhttp",
  "auto",
]);

export const BotEntrySchema = z.object({
  /** 机器人唯一标识 */
  botId: z.string().min(1),
  /** 是否启用此 bot */
  enabled: z.boolean().default(true),
  /** 传输模式 */
  mode: z.enum(["ws", "http", "hybrid"]),
  /** OneBot 实现类型，默认自动检测 */
  implementation: OneBotImplementationSchema.default("auto"),
  /** WS 配置 */
  ws: OneBotWsConfigSchema.optional(),
  /** HTTP 配置 */
  http: OneBotHttpConfigSchema.optional(),
});
```

#### 5. 适配器集成

```typescript
// packages/sdk/src/onebot/adapter.ts

export class OneBotAdapter {
  private readonly wsClient?: OneBotWsClient;
  private readonly httpClient?: OneBotHttpClient;
  private strategy?: OneBotStrategy;
  private eventHandler?: (event: BotEvent) => Promise<void> | void;

  constructor(private readonly config: OneBotAdapterConfig) {
    if (config.ws) {
      this.wsClient = new OneBotWsClient(config.botId, config.ws);
    }
    if (config.http) {
      this.httpClient = new OneBotHttpClient(config.http);
    }
    this._validateConfig();
  }

  async start(): Promise<void> {
    // ... 现有 WS 连接逻辑
    
    // 初始化策略（自动检测或使用配置）
    this.strategy = await StrategyFactory.create(
      this.config.implementation || "auto",
      this.httpClient
    );
    
    console.info(
      `[OneBotAdapter][${this.config.botId}] Using implementation: ${this.strategy.name}`
    );
  }

  async sendAction<TData = unknown>(
    request: OneBotActionRequest,
  ): Promise<ActionResult<TData>> {
    if (!this.httpClient) {
      return {
        ok: false,
        status: "failed",
        message: `[OneBotAdapter][${this.config.botId}] HTTP transport not configured`,
      };
    }

    // 检查是否为扩展 action
    const extendedActions = this.strategy?.getExtendedActions() ?? [];
    if (extendedActions.includes(request.action)) {
      console.debug(
        `[OneBotAdapter][${this.config.botId}] Handling extended action: ${request.action}`
      );
      
      // 如果策略有自定义处理逻辑，使用策略处理
      if (this.strategy?.handleExtendedAction) {
        return this.strategy.handleExtendedAction<TData>(
          request.action,
          request.params ?? {}
        );
      }
    }

    // 标准 action 或无自定义处理的扩展 action，走默认逻辑
    return this.httpClient.request<TData>(request);
  }

  /**
   * 获取当前使用的实现名称
   */
  get implementationName(): string | undefined {
    return this.strategy?.name;
  }
  
  // ... 其他现有方法
}
```

## 配置示例

### 自动检测（推荐）

```yaml
# bot.yaml
bot:
  botId: "my-bot"
  mode: "hybrid"
  implementation: "auto"  # 默认值，可省略
  ws:
    url: "ws://127.0.0.1:3001"
  http:
    baseUrl: "http://127.0.0.1:3000"
```

### 手动指定

```yaml
# bot.yaml
bot:
  botId: "my-bot"
  mode: "hybrid"
  implementation: "napcat"  # 手动指定为 NapCat
  ws:
    url: "ws://127.0.0.1:3001"
  http:
    baseUrl: "http://127.0.0.1:3000"
```

## 使用示例

### 标准 Action（所有实现通用）

```typescript
const adapter = new OneBotAdapter(config);
await adapter.start();

// 发送群消息 - 所有实现都支持
await adapter.sendAction({
  action: "send_group_msg",
  params: {
    group_id: 123456,
    message: "Hello World",
  },
});
```

### 扩展 Action（实现特有）

```typescript
// NapCat 特有：群签到
await adapter.sendAction({
  action: "set_group_sign",
  params: {
    group_id: 123456,
  },
});

// LLOneBot 特有：消息表情回应
await adapter.sendAction({
  action: "set_msg_emoji_like",
  params: {
    message_id: 789,
    emoji_id: "128077",  // 👍
  },
});
```

### 检查当前实现

```typescript
console.log(`Using implementation: ${adapter.implementationName}`);
// 输出: "Using implementation: napcat"
```

## 扩展指南

### 添加新的 OneBot 实现支持

1. **创建策略类**

```typescript
// packages/sdk/src/onebot/strategies/new-impl.strategy.ts

export class NewImplStrategy implements OneBotStrategy {
  readonly name = "new-impl";
  
  async getVersion(httpClient: OneBotHttpClient): Promise<VersionInfo> {
    // 实现版本获取逻辑
  }
  
  getExtendedActions(): string[] {
    return [
      // 列出该实现的特有 action
    ];
  }
  
  // 可选：自定义 action 处理
  async handleExtendedAction<T>(action: string, params: Record<string, unknown>): Promise<ActionResult<T>> {
    // 自定义处理逻辑
  }
}
```

2. **注册到工厂**

```typescript
// packages/sdk/src/onebot/strategy-factory.ts

import { NewImplStrategy } from "./strategies/new-impl.strategy.js";

// 在 strategies Map 中添加
private static strategies = new Map<string, OneBotStrategy>([
  // ... 现有策略
  ["new-impl", new NewImplStrategy()],
]);
```

3. **更新配置 Schema**

```typescript
// packages/config/src/schema.ts

export const OneBotImplementationSchema = z.enum([
  // ... 现有值
  "new-impl",
  "auto",
]);
```

## 注意事项

1. **向后兼容**：默认策略（go-cqhttp）确保现有配置无需修改即可工作
2. **错误处理**：自动检测失败时应优雅降级到默认策略
3. **日志记录**：检测结果和策略选择应记录到日志，便于调试
4. **类型安全**：扩展 action 的参数类型可通过泛型进一步约束
5. **测试覆盖**：每个策略应有独立的单元测试

## 未来扩展

1. **事件格式差异**：如果不同实现的事件格式有差异，可扩展策略接口添加事件解析方法
2. **消息格式差异**：如需处理消息格式差异，可添加消息转换层
3. **连接方式差异**：某些实现可能支持反向 WS 等其他连接方式
4. **能力查询**：添加 `getCapabilities()` 方法查询实现支持的功能

## 参考资料

- [OneBot v11 标准](https://github.com/botuniverse/onebot-11)
- [NapCat 文档](https://napneko.github.io/)
- [LLOneBot 文档](https://github.com/LLOneBot/LLOneBot)
- SnowLuma 文档（待补充）
