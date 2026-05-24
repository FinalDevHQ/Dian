import "reflect-metadata";

// 装饰器
export { Plugin, Handler, Interceptor } from "./decorators.js";
export {
  PLUGIN_META_KEY,
  HANDLER_META_KEY,
  INTERCEPTOR_META_KEY,
} from "./decorators.js";
export type {
  PluginMeta,
  PluginPublicMeta,
  CommandPublicMeta,
  CommandTreePublicMeta,
  DianRuntimeView,
  HandlerPublicMeta,
  HandlerMeta,
  InterceptorMeta,
  CommandEntry,
  RouteEntry,
  UIDeclaration,
  PluginSetupContext,
  PluginInstance,
  EventContext,
  PluginStore,
  Pattern,
  HttpMethod,
  RouteHandler,
} from "./decorators.js";

// Manager
export { PluginManager, pluginManager } from "./manager.js";
export { CommandRegistry } from "./registry/CommandRegistry.js";
export type {
  CommandHandler,
  CommandId,
  CommandPublicNode,
  CommandRecord,
  PluginId,
} from "./registry/CommandRegistry.js";
