# Hello World

一个完整的 Dian 插件示例，展示了所有常用功能。

## 完整代码

```typescript
import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

interface Config {
  command: string;
  reply: string;
}

const DEFAULT_CONFIG: Config = {
  command: "!hello",
  reply: "Hello World!",
};

@Plugin({
  name: "hello-world",
  description: "Hello World 插件示例",
  version: "1.0.0",
  author: "your-name",
  icon: "👋",
})
export default class HelloPlugin {
  private startTime = Date.now();
  private config: Config = { ...DEFAULT_CONFIG };
  private pingCount = 0;

  // 拦截器：记录所有消息
  @Interceptor(10)
  async logInterceptor(ctx: EventContext): Promise<void> {
    if (ctx.event.type === "message") {
      console.log(
        `[hello] ${ctx.event.payload.senderName}: ${ctx.event.payload.text}`
      );
    }
  }

  // 消息处理器：帮助命令
  @Handler(/^#?help$/i)
  async onHelp(ctx: EventContext): Promise<void> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    await ctx.reply(
      `📖 Hello World 插件\n` +
      `触发词：${this.config.command}  →  ${this.config.reply}\n` +
      `已运行：${uptime} 秒 | 累计触发：${this.pingCount} 次`
    );
  }

  onSetup(ctx: PluginSetupContext): void {
    // 注册动态指令
    ctx.command({
      name: this.config.command,
      pattern: () => this.config.command,  // 动态获取，配置改了立即生效
      description: `回复 "${this.config.reply}"`,
      category: "趣味",
      handler: async (c: EventContext) => {
        this.pingCount++;
        await c.reply(this.config.reply);
      },
    });

    // 注册 HTTP API
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({
        startTime: this.startTime,
        pingCount: this.pingCount,
        config: this.config,
      });
    });

    ctx.route("POST", "/config", (req, reply) => {
      const body = req.body as Partial<Config>;
      if (body.reply) this.config.reply = body.reply;
      if (body.command) this.config.command = body.command;
      reply.send({ ok: true, config: this.config });
    });

    // 声明 Web UI
    ctx.ui({ staticDir: "./public", entry: "index.html" });
  }
}
```

## 代码解析

### 1. 导入

```typescript
import "reflect-metadata";  // 必须导入，装饰器需要
import {
  Plugin,         // 插件装饰器
  Handler,        // 消息处理器装饰器
  Interceptor,    // 拦截器装饰器
  type EventContext,      // 事件上下文类型
  type PluginSetupContext, // 设置上下文类型
} from "@myfinal/plugin-runtime";
```

### 2. 插件元信息

```typescript
@Plugin({
  name: "hello-world",      // 插件名字
  description: "...",       // 描述
  version: "1.0.0",         // 版本
  author: "your-name",      // 作者
  icon: "👋",               // 图标
})
```

### 3. 拦截器

```typescript
@Interceptor(10)  // 优先级 10，数字越小越先执行
async logInterceptor(ctx: EventContext): Promise<void> {
  // 记录所有消息到控制台
  console.log(`${ctx.event.payload.senderName}: ${ctx.event.payload.text}`);
}
```

### 4. 消息处理器

```typescript
@Handler(/^#?help$/i)  // 匹配 "help" 或 "#help"（不区分大小写）
async onHelp(ctx: EventContext): Promise<void> {
  await ctx.reply("帮助信息...");
}
```

### 5. onSetup

```typescript
onSetup(ctx: PluginSetupContext): void {
  // 注册指令
  ctx.command({
    name: "!hello",
    pattern: () => this.config.command,  // 动态 pattern
    description: "打招呼",
    category: "趣味",
    handler: async (c) => {
      await c.reply("Hello World!");
    },
  });

  // 注册 HTTP API
  ctx.route("GET", "/status", (_req, reply) => {
    reply.send({ count: this.pingCount });
  });

  // 声明 Web UI
  ctx.ui({ staticDir: "./public" });
}
```

## 运行效果

**发送消息：**
```
help
```

**回复：**
```
📖 Hello World 插件
触发词：!hello  →  Hello World!
已运行：60 秒 | 累计触发：5 次
```

**发送消息：**
```
!hello
```

**回复：**
```
Hello World!
```

## HTTP API

启动后可以访问：

- `GET /plugins/hello-world/api/status` — 获取插件状态
- `POST /plugins/hello-world/api/config` — 更新配置

## Web UI

如果插件有 `public` 目录，可以通过 Web 控制台访问插件 UI。

## 下一步

现在你已经看完了完整示例，可以继续学习：
- [自定义插件](/examples/custom-plugin) — 从零创建一个功能完整的插件
- [热重载](/advanced/hot-reload) — 了解如何边开发边测试
