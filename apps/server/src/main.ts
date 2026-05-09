import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configService } from "@dian/config";
import { logService } from "@dian/logger";
import { pluginManager } from "@dian/plugin-runtime";
import { BotManager } from "./bot/bot-manager.js";
import { EventDispatcher } from "./event/event-dispatcher.js";
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

  // ── 3. 加载插件 ───────────────────────────────────────────────────────────
  logger.info(`Loading plugins from ${PLUGINS_DIR}`);
  await pluginManager.loadAll(PLUGINS_DIR);

  // ── 4. 事件分发器 & BotManager ────────────────────────────────────────────
  const dispatcher = new EventDispatcher(logger);
  const botManager = new BotManager(
    configService,
    logger,
    (event) => dispatcher.dispatch(event)
  );

  // ── 5. 启动 HTTP 服务器 ───────────────────────────────────────────────────
  const server = await createServer({
    port: Number(process.env.PORT ?? 3000),
    logger,
    botManager,
    configDir: CONFIG_DIR,
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
