# 装饰器

装饰器是 Dian 插件的核心，它们是 `@` 开头的特殊语法，用来给你的代码添加功能。

## 三个核心装饰器

Dian 有三个主要的装饰器：

| 装饰器 | 作用 | 用在哪 |
|--------|------|--------|
| `@Plugin` | 标记这是一个 Dian 插件 | 类 |
| `@Handler` | 处理用户消息 | 方法 |
| `@Interceptor` | 拦截消息（日志、鉴权等） | 方法 |

## @Plugin

`@Plugin` 用来标记一个类是 Dian 插件。每个插件文件只能有一个 `@Plugin`。

```typescript
@Plugin({
  name: "my-plugin",          // 插件名字（必须，英文小写加横杠）
  description: "我的插件",     // 描述（可选）
  version: "1.0.0",           // 版本（可选）
  author: "你的名字",          // 作者（可选）
  icon: "🚀",                // 图标（可选，emoji 或 URL）
})
export default class MyPlugin {
  // 插件代码写在这里
}
```

**参数说明：**

| 参数 | 必需 | 说明 |
|------|------|------|
| `name` | ✅ | 插件唯一标识，必须英文小写加横杠，如 `my-plugin` |
| `description` | ❌ | 插件描述，会显示在管理界面 |
| `version` | ❌ | 版本号 |
| `author` | ❌ | 作者名字 |
| `icon` | ❌ | 图标，可以是 emoji（如 `"🚀"`）或图片 URL |

## @Handler

`@Handler` 用来标记一个方法是消息处理器。当用户发送的消息匹配时，这个方法会被调用。

### 精确匹配

```typescript
@Handler("你好")
async onHello(ctx: EventContext): Promise<void> {
  await ctx.reply("你好！");
}
```

只有当用户发送的内容完全等于 `"你好"` 时才会触发。

### 正则匹配

```typescript
@Handler(/^打卡(.*)?$/)
async onCheckIn(ctx: EventContext): Promise<void> {
  await ctx.reply("打卡成功！");
}
```

使用正则表达式匹配，上面的例子会匹配 `"打卡"`、`"打卡签到"` 等。

### 动态匹配

```typescript
@Handler(() => this.config.command)
async onCommand(ctx: EventContext): Promise<void> {
  await ctx.reply("收到！");
}
```

使用函数返回匹配规则，配置修改后立即生效，不用重启。

**Pattern 类型总结：**

| 类型 | 说明 | 示例 |
|------|------|------|
| `string` | 精确匹配 | `"你好"` |
| `RegExp` | 正则匹配 | `/^打卡/` |
| `() => string \| RegExp` | 动态匹配 | `() => this.config.command` |

## @Interceptor

`@Interceptor` 用来拦截消息，在所有 `@Handler` 之前执行。适合做日志、鉴权、过滤等。

```typescript
@Interceptor(10)  // 数字越小越先执行
async logMessage(ctx: EventContext): Promise<void> {
  console.log(`收到消息: ${ctx.event.payload.text}`);
}
```

**参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `priority` | `100` | 优先级，数字越小越先执行 |

**使用场景：**

```typescript
// 场景 1：记录日志
@Interceptor(1)
async logAll(ctx: EventContext): Promise<void> {
  console.log(`[${ctx.event.subtype}] ${ctx.event.payload.text}`);
}

// 场景 2：权限检查
@Interceptor(50)
async checkAuth(ctx: EventContext): Promise<void> {
  if (this.isBlacklisted(ctx.event.payload.userId)) {
    ctx.stopPropagation();  // 阻止后续处理器执行
  }
}
```

## stopPropagation()

调用 `ctx.stopPropagation()` 可以阻止后续的 Handler 和指令执行。

```typescript
@Interceptor(10)
async blockBlacklist(ctx: EventContext): Promise<void> {
  if (this.isBlacklisted(ctx.event.payload.userId)) {
    ctx.stopPropagation();  // 黑名单用户的消息不再处理
  }
}
```

## 导入装饰器

所有装饰器都从 `@myfinal/plugin-runtime` 导入：

```typescript
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";
```

## 完整示例

```typescript
import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

@Plugin({
  name: "my-plugin",
  description: "示例插件",
})
export default class MyPlugin {
  // 拦截器：记录所有消息
  @Interceptor(1)
  async logMessage(ctx: EventContext): Promise<void> {
    if (ctx.event.type === "message") {
      console.log(`${ctx.event.payload.senderName}: ${ctx.event.payload.text}`);
    }
  }

  // 消息处理器：匹配 "你好"
  @Handler("你好")
  async onHello(ctx: EventContext): Promise<void> {
    await ctx.reply("你好！");
  }

  // 消息处理器：匹配 "打卡" 开头的消息
  @Handler(/^打卡/)
  async onCheckIn(ctx: EventContext): Promise<void> {
    await ctx.reply("打卡成功！");
  }

  // onSetup：注册更多指令
  onSetup(ctx: PluginSetupContext): void {
    ctx.command({
      name: "帮助",
      pattern: "帮助",
      description: "显示帮助信息",
      handler: async (c) => {
        await c.reply("可用指令：你好、打卡、帮助");
      },
    });
  }
}
```

## 下一步

- [EventContext](/api/event-context) — 了解事件上下文的完整 API
- [SetupContext](/api/setup-context) — 了解 onSetup 的完整 API
- [PluginStore](/api/plugin-store) — 了解插件存储
