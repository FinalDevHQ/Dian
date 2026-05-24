import type { BotEvent, SendActionFn } from "@myfinal/shared";
import type { EventContext, PluginInstance, PluginStore } from "../decorators.js";
import { extractMessageText } from "../utils/message.js";
import { generateHelpText, generatePluginHelpText } from "../help/HelpGenerator.js";
import { runInterceptors } from "./InterceptorPipeline.js";
import { routeToHandlers } from "./CommandRouter.js";

const HELP_PATTERN = /^菜单$|^help$|^帮助$/i;

/**
 * 完整事件分发管线：interceptors → 内置帮助 → handlers/commands。
 * 纯函数，所有依赖通过参数注入。
 */
export async function dispatchEvent(
  plugins: PluginInstance[],
  blacklist: Set<string>,
  isPluginEnabledForBot: (name: string, botId: string) => boolean,
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

  // 2. 内置帮助命令
  const messageText = extractMessageText(event);
  const trimmedText = messageText.trim();
  if (HELP_PATTERN.test(trimmedText)) {
    try {
      await reply(generateHelpText(plugins, blacklist));
    } catch (err) {
      console.error(`[plugin-runtime] 生成帮助菜单异常:`, err);
    }
    return;
  }

  // 3. 二级菜单：用户发送插件名，展开该插件的命令列表
  const pluginHelp = generatePluginHelpText(plugins, blacklist, trimmedText);
  if (pluginHelp) {
    try {
      await reply(pluginHelp);
    } catch (err) {
      console.error(`[plugin-runtime] 生成插件帮助异常:`, err);
    }
    return;
  }

  // 4. handlers + commands
  await routeToHandlers(plugins, blacklist, isPluginEnabledForBot, messageText, ctx);
}
