import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@dian/plugin-runtime";

// ─────────────────────────────────────────────────────────────────────────────
// 修改 @Plugin 里的 name 来设置插件 ID（需全局唯一）
// ─────────────────────────────────────────────────────────────────────────────

@Plugin({
  name: "my-plugin",        // ← 插件唯一标识，会出现在 /plugins/:name/... 路由中
  description: "插件模板",
  version: "1.0.0",
  author: "your-name",
  icon: "🔌",               // emoji 或图标 URL
})
export default class MyPlugin {

  // ── 消息 Handler ─────────────────────────────────────────────────────────
  // @Handler 支持精确字符串或正则表达式，匹配消息文本后调用对应方法。

  /** 精确匹配 "!ping" */
  @Handler("!ping")
  async onPing(ctx: EventContext): Promise<void> {
    const { event } = ctx;
    console.log(
      `[my-plugin] ping from ${event.payload.senderName} (${event.payload.userId})`
    );
    // 在此调用 bot API 发送回复，例如：
    // await botApi.sendGroupMessage(event.payload.groupId!, "pong!");
  }

  /** 正则匹配 "!echo <内容>" */
  @Handler(/^!echo (.+)$/)
  async onEcho(ctx: EventContext): Promise<void> {
    const text = ctx.event.payload.text ?? "";
    const match = text.match(/^!echo (.+)$/);
    const content = match?.[1] ?? "";
    console.log(`[my-plugin] echo: ${content}`);
  }

  // ── 拦截器 ───────────────────────────────────────────────────────────────
  // 在所有 Handler 之前运行，priority 越小越先执行（默认 100）。
  // 调用 ctx.stopPropagation() 可阻止后续所有 Handler。

  @Interceptor(50)
  async globalFilter(ctx: EventContext): Promise<void> {
    // 示例：屏蔽特定群
    const blockedGroups: string[] = [];
    if (ctx.event.payload.groupId && blockedGroups.includes(ctx.event.payload.groupId)) {
      ctx.stopPropagation();
    }
  }

  // ── onSetup：注册 HTTP 路由 / 指令 / Web UI ───────────────────────────────
  // 框架在加载插件后调用此方法。不需要可整个删除。

  onSetup(ctx: PluginSetupContext): void {
    // ── HTTP API ────────────────────────────────────────────────────────────
    // 访问地址：GET /plugins/my-plugin/api/status
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({ ok: true, plugin: "my-plugin", timestamp: Date.now() });
    });

    // ── 命令式指令（与 @Handler 等价，额外携带 description） ─────────────────
    ctx.command({
      name: "/help",
      pattern: "!help",
      description: "显示帮助信息",
      async handler(c) {
        console.log(`[my-plugin] help from ${c.event.payload.senderName}`);
      },
    });

    // ── Web UI（静态文件，build 后 dist/public/ 目录）────────────────────────
    // 访问地址：/plugins/my-plugin/ui/
    // 在管理界面会以 iframe 形式嵌入
    ctx.ui({ staticDir: "./public", entry: "index.html" });
  }
}
