# SetupContext

`onSetup` 方法接收的上下文对象，用来注册指令、HTTP API、Web UI 等。

## 快速上手

```typescript
@Plugin({ name: "my-plugin" })
export default class MyPlugin {
  onSetup(ctx: PluginSetupContext): void {
    // 注册一个指令
    ctx.command({
      name: "帮助",
      pattern: "帮助",
      description: "显示帮助信息",
      category: "基础",
      handler: async (c) => {
        await c.reply("可用指令：帮助、签到");
      },
    });

    // 注册一个 HTTP API
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({ status: "ok" });
    });
  }
}
```

## 方法详解

### ctx.command()

注册消息指令，会显示在帮助菜单里。

```typescript
ctx.command({
  name: "签到",              // 指令名称
  pattern: "签到",           // 匹配规则
  description: "每日签到",   // 描述
  category: "积分",          // 分类（帮助菜单分组）
  handler: async (c) => {    // 处理函数
    await c.reply("签到成功！");
  },
});
```

**参数：**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | `string` | ✅ | 指令名称 |
| `pattern` | `Pattern` | ✅ | 匹配规则（和 @Handler 一样） |
| `description` | `string` | ❌ | 指令描述 |
| `handler` | `Function` | ✅ | 处理函数 |
| `category` | `string` | ❌ | 分类名（帮助菜单分组） |
| `children` | `CommandEntry[]` | ❌ | 子命令（树状菜单） |

**Pattern 类型：**

```typescript
// 精确匹配
pattern: "签到"

// 正则匹配
pattern: /^签到(.+)?$/

// 动态匹配（函数）
pattern: () => this.config.signInCommand
```

### ctx.route()

注册 HTTP API 路由。

```typescript
// GET /plugins/my-plugin/api/status
ctx.route("GET", "/status", (_req, reply) => {
  reply.send({ status: "ok" });
});

// POST /plugins/my-plugin/api/config
ctx.route("POST", "/config", (req, reply) => {
  const body = req.body;
  console.log(body);
  reply.send({ ok: true });
});
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `method` | `string` | HTTP 方法：GET、POST、PUT、DELETE |
| `path` | `string` | 路径（自动加 `/plugins/:name/api` 前缀） |
| `handler` | `Function` | 处理函数 |

**Handler 参数：**

```typescript
type RouteHandler = (request: any, reply: any) => unknown | Promise<unknown>;
```

- `request` — 请求对象（包含 body、query、params 等）
- `reply` — 响应对象（有 `send`、`status` 等方法）

### ctx.ui()

声明插件的 Web UI。

```typescript
// 方式 1：静态文件目录
ctx.ui({
  staticDir: "./public",  // 相对于插件目录
  entry: "index.html",   // 入口文件（默认 index.html）
});

// 方式 2：外部 URL
ctx.ui({
  externalUrl: "http://localhost:3000",
});
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `staticDir` | `string` | 静态文件目录 |
| `externalUrl` | `string` | 外部 URL（iframe src） |
| `entry` | `string` | 入口文件（默认 `index.html`） |

::: warning 注意
`staticDir` 和 `externalUrl` 不能同时使用。
:::

### ctx.datasource()

声明插件的 SQLite 数据源，会在数据库管理界面显示。

```typescript
ctx.datasource("my-plugin", "/path/to/data.sqlite");
```

**参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 数据源名称 |
| `sqliteFile` | `string` | SQLite 文件的绝对路径 |

## 完整示例

```typescript
import "reflect-metadata";
import {
  Plugin,
  Handler,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

@Plugin({
  name: "my-plugin",
  description: "功能完整的插件示例",
})
export default class MyPlugin {
  private count = 0;

  onSetup(ctx: PluginSetupContext): void {
    // 注册指令 1：查看状态
    ctx.command({
      name: "状态",
      pattern: "状态",
      description: "查看插件状态",
      category: "基础",
      handler: async (c) => {
        await c.reply(`累计触发: ${this.count} 次`);
      },
    });

    // 注册指令 2：带子命令
    ctx.command({
      name: "积分",
      pattern: "积分",
      description: "积分系统",
      category: "积分",
      handler: async (c) => {
        await c.reply("使用方法：积分 [查/签到]");
      },
      children: [
        {
          name: "查",
          pattern: "积分查",
          description: "查看我的积分",
          handler: async (c) => {
            await c.reply("你有 100 积分");
          },
        },
        {
          name: "签到",
          pattern: "积分签到",
          description: "每日签到",
          handler: async (c) => {
            this.count++;
            await c.reply("签到成功！");
          },
        },
      ],
    });

    // 注册 HTTP API
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({
        count: this.count,
        uptime: process.uptime(),
      });
    });

    ctx.route("POST", "/config", (req, reply) => {
      const body = req.body;
      console.log("收到配置:", body);
      reply.send({ ok: true });
    });

    // 声明 Web UI
    ctx.ui({ staticDir: "./public" });

    // 声明数据源
    ctx.datasource("my-plugin", "/path/to/data.sqlite");
  }

  @Handler("帮助")
  async onHelp(ctx: EventContext): Promise<void> {
    await ctx.reply(
      "可用指令：\n" +
      "- 状态：查看插件状态\n" +
      "- 积分：积分系统\n" +
      "- 帮助：显示此帮助"
    );
  }
}
```

## 下一步

- [EventContext](/api/event-context) — 了解事件上下文的完整 API
- [PluginStore](/api/plugin-store) — 了解插件存储
- [示例](/examples/hello-world) — 查看更多示例代码
