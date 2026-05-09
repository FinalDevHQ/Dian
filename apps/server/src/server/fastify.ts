import Fastify from "fastify";
import cors from "@fastify/cors";
import type { LogService } from "@dian/logger";
import type { BotManager } from "../bot/bot-manager.js";
import type { EventBus } from "../event/event-bus.js";
import type { DatabaseExplorer } from "../db/explorer.js";
import { healthRoutes } from "../routes/health.js";
import { configRoutes } from "../routes/config.js";
import { eventRoutes } from "../routes/events.js";
import { dbRoutes } from "../routes/db.js";
import { pluginRoutes } from "../routes/plugins.js";

export interface ServerOptions {
  host?: string;
  port?: number;
  logger: LogService;
  botManager: BotManager;
  configDir: string;
  eventBus: EventBus;
  dbExplorer: DatabaseExplorer;
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
    eventBus,
    dbExplorer,
  } = opts;

  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  // 路由
  await app.register(healthRoutes, { logger, botManager });
  await app.register(configRoutes, { logger, configDir });
  await app.register(eventRoutes, { logger, bus: eventBus });
  await app.register(dbRoutes, { logger, explorer: dbExplorer });
  await app.register(pluginRoutes, { logger });

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
