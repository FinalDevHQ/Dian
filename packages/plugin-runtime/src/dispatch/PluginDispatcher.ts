import type { BotEvent, SendActionFn } from "@myfinal/shared";
import type { EventContext, PluginInstance, PluginStore } from "../decorators.js";
import type { CommandRecord } from "../registry/CommandRegistry.js";
import { extractMessageText } from "../utils/message.js";
import { runInterceptors } from "./InterceptorPipeline.js";
import { routeToHandlers } from "./CommandRouter.js";

/**
 * 完整事件分发管线：interceptors → handlers/commands。
 * Help 展示由 Dian-plugin-help 通过普通 command 提供，runtime 只负责路由。
 * 纯函数，所有依赖通过参数注入。
 */
export async function dispatchEvent(
  plugins: PluginInstance[],
  blacklist: Set<string>,
  isPluginEnabledForBot: (name: string, botId: string) => boolean,
  getCommandsForPlugin: (pluginId: string) => CommandRecord[],
  event: BotEvent,
  reply: (text: string) => Promise<void>,
  sendAction: SendActionFn,
  store?: PluginStore,
): Promise<void> {
  let stopped = false;
  const ctx: EventContext = {
    event,
    stopPropagation() { stopped = true; },
    reply,
    sendAction,
    store,
  };

  // 1. interceptors
  if (await runInterceptors(plugins, blacklist, isPluginEnabledForBot, ctx)) return;

  const messageText = extractMessageText(event);
  await routeToHandlers(plugins, blacklist, isPluginEnabledForBot, getCommandsForPlugin, messageText, ctx);
}
