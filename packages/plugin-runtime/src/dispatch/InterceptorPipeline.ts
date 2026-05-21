import type { BotEvent } from "@myfinal/shared";
import type { EventContext, InterceptorMeta, PluginInstance } from "../decorators.js";

/**
 * 执行 interceptor 管线。
 * 按 priority 升序执行，任意 interceptor 可调用 stopPropagation() 终止。
 * 返回 true 表示事件已被拦截（stopped）。
 */
export async function runInterceptors(
  plugins: PluginInstance[],
  blacklist: Set<string>,
  isPluginEnabledForBot: (name: string, botId: string) => boolean,
  ctx: EventContext,
): Promise<boolean> {
  const allInterceptors: Array<{ plugin: PluginInstance; meta: InterceptorMeta }> = [];
  for (const plugin of plugins) {
    if (blacklist.has(plugin.meta.name)) continue;
    if (!isPluginEnabledForBot(plugin.meta.name, ctx.event.botId)) continue;
    for (const im of plugin.interceptors) {
      allInterceptors.push({ plugin, meta: im });
    }
  }
  allInterceptors.sort((a, b) => a.meta.priority - b.meta.priority);

  let stopped = false;
  const wrappedCtx: EventContext = {
    ...ctx,
    stopPropagation() { stopped = true; },
  };

  for (const { plugin, meta } of allInterceptors) {
    if (stopped) return true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (plugin.instance as any)[meta.method](wrappedCtx);
    } catch (err) {
      console.error(`[plugin-runtime] interceptor "${meta.method}" 异常:`, err);
    }
  }

  return stopped;
}
