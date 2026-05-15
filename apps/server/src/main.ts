import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configService } from "@dian/config";
import { logService } from "@dian/logger";
import { pluginManager } from "@dian/plugin-runtime";
import { storageService } from "@dian/storage";
import { BotManager } from "./bot/bot-manager.js";
import { EventBus } from "./event/event-bus.js";
import { EventDispatcher } from "./event/event-dispatcher.js";
import { DatabaseExplorer } from "./db/explorer.js";
import { AuthService } from "./auth/service.js";
import { installLogPersistence } from "./log-bridge.js";
import { installMessagePersistence } from "./message-bridge.js";
import { createPluginScopeIO } from "./plugin-scope.js";
import { createServer } from "./server/fastify.js";

// ---------------------------------------------------------------------------
// 根目录（项目根，config/ 在此目录下）
// ---------------------------------------------------------------------------
const ROOT_DIR = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const CONFIG_DIR = resolve(ROOT_DIR, "config");
const PLUGINS_DIR = resolve(ROOT_DIR, "plugins");

async function main(): Promise<void> {
  // ── 1. 加载配置 ──────────────────────────────────────────────────────────
  configService.init(CONFIG_DIR);

  // ── 2. 初始化日志 ─────────────────────────────────────────────────────────
  logService.init({
    level: configService.settings.logLevel,
    pretty: process.env.NODE_ENV !== "production",
  });
  const logger = logService;
  logger.info("Dian server starting...");

  // ── 2b. 初始化持久化存储 + 日志镜像写入 ───────────────────────────────────
  if (configService.settings.storage?.sqlite || configService.settings.storage?.mysql) {
    await storageService.init({
      sqlite: configService.settings.storage.sqlite
        ? resolve(ROOT_DIR, configService.settings.storage.sqlite)
        : undefined,
      mysql: configService.settings.storage.mysql,
    });
    if (storageService.hasLog) {
      installLogPersistence(logger, storageService.log);
      logger.info("Log persistence enabled");
    }
    if (storageService.hasMessage) {
      logger.info("Message persistence enabled");
    }
  }

  // ── 3. 加载插件 ───────────────────────────────────────────────────────────
  logger.info(`Loading plugins from ${PLUGINS_DIR}`);
  await pluginManager.loadAll(PLUGINS_DIR);
  pluginManager.watch(); // 监听新安装的插件文件，自动热加载

  // ── 3b. 加载插件 bot 白名单（必须在插件 load 之后；scope 与插件按 name 关联） ──
  const pluginScopeIO = createPluginScopeIO(CONFIG_DIR, logger);
  await pluginScopeIO.load();

  // ── 4a. 数据库浏览器（按 settings.storage 注册数据源） ────────────────────
  const dbExplorer = new DatabaseExplorer(logger);
  if (configService.settings.storage?.sqlite) {
    const sqliteFile = resolve(
      ROOT_DIR,
      configService.settings.storage.sqlite
    );
    dbExplorer.registerSqlite("default", sqliteFile);
  }

  // ── 4b. 事件总线 + 分发器 & BotManager ────────────────────────────────────
  const eventBus = new EventBus(200);
  const dispatcher = new EventDispatcher(logger);

  // 消息持久化回调（在事件进入 dispatcher 前先写 DB）
  const persistMessage = storageService.hasMessage
    ? installMessagePersistence(storageService.message)
    : null;

  // 注入消息仓库到 dispatcher，用于存储机器人发送的消息
  if (storageService.hasMessage) {
    dispatcher.setMessageRepository(storageService.message);
  }

  const botManager = new BotManager(
    configService,
    logger,
    async (event) => {
      persistMessage?.(event);
      eventBus.publish(event);
      await dispatcher.dispatch(event);
    }
  );
  // 将 botManager 注入 dispatcher，用于构建 reply 回调
  dispatcher.setBotManager(botManager);

  // ── 5. 初始化认证服务 ─────────────────────────────────────────────────────
  const authService = new AuthService(configService.settings.auth ?? {});
  if (authService.isConfigured()) {
    logger.info("Auth service enabled");
  } else {
    logger.warn("Auth service disabled: no password configured");
  }

  // ── 6. 启动 HTTP 服务器 ───────────────────────────────────────────────────
  const server = await createServer({
    port: Number(process.env.PORT ?? 3000),
    logger,
    botManager,
    configDir: CONFIG_DIR,
    pluginsDir: PLUGINS_DIR,
    eventBus,
    dbExplorer,
    messageRepo: storageService.hasMessage ? storageService.message : undefined,
    persistPluginScope: () => pluginScopeIO.save(),
    authService,
  });
  await server.start();

  // ── 6. 启动所有 Bot ───────────────────────────────────────────────────────
  await botManager.start();

  // ── 7. 热重载配置变更 ────────────────────────────────────────────────────
  configService.watch();
  configService.on("change", async ({ file }) => {
    logger.info(`Config changed: ${file}, reloading bots...`);
    await botManager.reloadConfig();
  });

  // ── 8. 优雅退出 ──────────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    configService.unwatch();
    await botManager.stop();
    await server.stop();
    dbExplorer.close();
    await storageService.close();
    logger.info("Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
