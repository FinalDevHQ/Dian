import Fastify from "fastify";
import cors from "@fastify/cors";
import type { LogService } from "@dian/logger";
import type { MessageRepository } from "@dian/storage";
import type { BotManager } from "../bot/bot-manager.js";
import type { EventBus } from "../event/event-bus.js";
import type { DatabaseExplorer } from "../db/explorer.js";
import { healthRoutes } from "../routes/health.js";
import { systemRoutes } from "../routes/system.js";
import { configRoutes } from "../routes/config.js";
import { eventRoutes } from "../routes/events.js";
import { dbRoutes } from "../routes/db.js";
import { pluginRoutes } from "../routes/plugins.js";
import { botsRoutes } from "../routes/bots.js";
import { statsRoutes } from "../routes/stats.js";

export interface ServerOptions {
  host?: string;
  port?: number;
  logger: LogService;
  botManager: BotManager;
  configDir: string;
  pluginsDir: string;
  eventBus: EventBus;
  dbExplorer: DatabaseExplorer;
  messageRepo?: MessageRepository;
  /** 插件 bot 白名单持久化（已在 main.ts 中创建） */
  persistPluginScope: () => Promise<void>;
}

/**
 * 创建并配置 Fastify 实例
 */
export async function createServer(opts: ServerOptions): Promise<{
  start: () => Promise<void>;
  stop: () => Promise<void>;
}> {
  const {
    host = "0.0.0.0",
    port = 3000,
    logger,
    botManager,
    configDir,
    pluginsDir,
    eventBus,
    dbExplorer,
    messageRepo,
    persistPluginScope,
  } = opts;

  const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 }); // 50 MB

  await app.register(cors, { origin: true });

  // ZIP / 二进制上传支持（插件安装用）
  app.addContentTypeParser(
    ["application/zip", "application/octet-stream", "application/x-zip-compressed"],
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body)
  );

  // 路由
  await app.register(healthRoutes, { logger, botManager });
  await app.register(systemRoutes, { logger });
  await app.register(configRoutes, { logger, configDir });
  await app.register(eventRoutes, { logger, bus: eventBus });
  await app.register(dbRoutes, { logger, explorer: dbExplorer });
  await app.register(pluginRoutes, {
    logger,
    pluginsDir,
    knownBotIds: () => botManager.getBots().map((b) => b.botId),
    persistPluginScope,
  });
  await app.register(botsRoutes, { logger, configDir });
  if (messageRepo) {
    await app.register(statsRoutes, { messageRepo, botManager });
  }

  return {
    async start() {
      await app.listen({ host, port });
      logger.info(`HTTP server listening on http://${host}:${port}`);
    },
    async stop() {
      await app.close();
      logger.info("HTTP server closed");
    },
  };
}
