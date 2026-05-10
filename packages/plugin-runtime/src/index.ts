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
  HandlerPublicMeta,
  HandlerMeta,
  InterceptorMeta,
  CommandEntry,
  RouteEntry,
  UIDeclaration,
  PluginSetupContext,
  PluginInstance,
  EventContext,
  Pattern,
  HttpMethod,
  RouteHandler,
} from "./decorators.js";

// Manager
export { PluginManager, pluginManager } from "./manager.js";
