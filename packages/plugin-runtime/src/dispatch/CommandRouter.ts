import type { EventContext, PluginInstance } from "../decorators.js";
import type { CommandRecord } from "../registry/CommandRegistry.js";
import { matchPattern } from "../utils/pattern.js";

/**
 * 执行匹配 pattern 的 handlers 和 commands。
 * 返回 true 表示事件处理过程中调用了 stopPropagation。
 */
export async function routeToHandlers(
  plugins: PluginInstance[],
  blacklist: Set<string>,
  isPluginEnabledForBot: (name: string, botId: string) => boolean,
  getCommandsForPlugin: (pluginId: string) => CommandRecord[],
  messageText: string,
  ctx: EventContext,
): Promise<boolean> {
  let stopped = false;
  const wrappedCtx: EventContext = {
    ...ctx,
    stopPropagation() { stopped = true; },
  };

  for (const plugin of plugins) {
    if (stopped) return true;
    if (blacklist.has(plugin.meta.name)) continue;
    if (!isPluginEnabledForBot(plugin.meta.name, ctx.event.botId)) continue;

    for (const hm of plugin.handlers) {
      if (stopped) break;
      if (!matchPattern(hm.pattern, messageText)) continue;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (plugin.instance as any)[hm.method](wrappedCtx);
      } catch (err) {
        console.error(
          `[plugin-runtime] handler "${plugin.meta.name}.${hm.method}" 异常:`,
          err,
        );
      }
    }

    for (const cmd of getCommandsForPlugin(plugin.meta.name)) {
      if (stopped) break;
      if (!cmd.pattern || !cmd.handler) continue;
      if (!matchPattern(cmd.pattern, messageText)) continue;
      try {
        await cmd.handler(wrappedCtx);
      } catch (err) {
        console.error(
          `[plugin-runtime] command "${plugin.meta.name}/${cmd.name}" 异常:`,
          err,
        );
      }
    }
  }

  return stopped;
}
