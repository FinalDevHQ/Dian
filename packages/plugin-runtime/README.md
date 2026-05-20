# @myfinal/plugin-runtime

[Dian](https://github.com/FinalDevHQ/Dian) 框架的插件运行时，提供插件装饰器、事件分发和热重载能力。

## 安装

```bash
npm install @myfinal/plugin-runtime reflect-metadata
```

> `reflect-metadata` 是 decorator metadata 的必要 polyfill，需在入口文件最顶部 `import "reflect-metadata"`。

## 快速上手

```ts
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
  version: "1.0.0",
  author: "you",
  icon: "🤖",
})
export default class MyPlugin {
  // 事件处理器：匹配消息文本
  @Handler(/^#?help$/i)
  async onHelp(ctx: EventContext) {
    await ctx.reply("📖 帮助信息...");
  }

  // 拦截器：优先级越小越先执行，可用于日志、鉴权、过滤
  @Interceptor(10)
  async logger(ctx: EventContext) {
    if (ctx.event.type === "message") {
      console.log(`[${ctx.event.platform}] ${ctx.event.payload.text}`);
    }
  }

  // 生命周期钩子：注册指令、路由、UI
  onSetup(ctx: PluginSetupContext) {
    ctx.command({
      name: "ping",
      pattern: () => "!ping",   // 函数形式支持运行时热更新
      description: "回复 pong",
      handler: async (c) => {
        await c.reply("pong!");
      },
    });

    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({ ok: true });
    });

    ctx.ui({ staticDir: "./public", entry: "index.html" });
  }
}
```

## 装饰器

### `@Plugin(meta)`

标记一个类为 Dian 插件。

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 插件唯一标识（kebab-case） |
| `description` | `string?` | 插件描述 |
| `version` | `string?` | 版本号 |
| `author` | `string?` | 作者 |
| `icon` | `string?` | emoji 或图标 URL |

### `@Handler(pattern)`

将方法注册为事件处理器，`pattern` 支持：
- `string` — 与消息文本精确匹配
- `RegExp` — 正则匹配
- `() => string | RegExp` — 动态 pattern，每次事件分发时求值，支持热更新

### `@Interceptor(priority?)`

将方法注册为拦截器，在所有 handler 之前按优先级顺序执行。数字越小越先执行，默认 `100`。

## `EventContext`

| 属性 / 方法 | 说明 |
|------------|------|
| `event` | 当前 `BotEvent` 事件对象 |
| `reply(text)` | 向事件来源（群/私聊）发送文本回复 |
| `sendAction(action, params)` | 调用底层 OneBot API（如 `set_group_ban`） |
| `stopPropagation()` | 阻止后续 handler 继续处理 |
| `store` | 插件专属 SQLite 存储接口 |

## `PluginSetupContext`

| 方法 | 说明 |
|------|------|
| `command(entry)` | 注册指令（支持动态 pattern、子命令、分类） |
| `route(method, path, handler)` | 注册 HTTP API 路由（自动带 `/plugins/:name/api` 前缀） |
| `ui(decl)` | 声明插件 Web UI |
| `datasource(name, sqliteFile)` | 注册插件专属 SQLite 数据源（在数据库浏览器中可见） |

## 相关包

- [`@myfinal/shared`](https://www.npmjs.com/package/@myfinal/shared) — 共享类型
- [Dian 主仓库](https://github.com/FinalDevHQ/Dian)
- [插件模板](https://github.com/FinalDevHQ/Dian-plugin-template)
