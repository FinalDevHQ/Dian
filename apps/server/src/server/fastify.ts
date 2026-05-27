import Fastify from "fastify";
import cors from "@fastify/cors";
import type { LogService } from "@myfinal/logger";
import type { MessageRepository, SqlitePluginStore } from "@myfinal/storage";
import type { BotService } from "../bot/bot-service.js";
import type { EventBus } from "../event/event-bus.js";
import type { DatabaseExplorer } from "../db/explorer.js";
import type { AuthService } from "../auth/service.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import { authRoutes } from "../routes/auth.js";
import { healthRoutes } from "../routes/health.js";
import { systemRoutes } from "../routes/system.js";
import { configRoutes } from "../routes/config.js";
import { eventRoutes } from "../routes/events.js";
import { dbRoutes } from "../routes/db.js";
import { pluginRoutes } from "../routes/plugins.js";
import { botRoutes } from "../routes/bots.js";
import { statsRoutes } from "../routes/stats.js";

export interface ServerOptions {
  host?: string;
  port?: number;
  logger: LogService;
  botService: BotService;
  configDir: string;
  pluginsDir: string;
  eventBus: EventBus;
  dbExplorer: DatabaseExplorer;
  messageRepo?: MessageRepository;
  pluginStore?: SqlitePluginStore;
  /** 插件 bot 白名单持久化（已在 main.ts 中创建） */
  persistPluginScope: () => Promise<void>;
  /** 认证服务 */
  authService: AuthService;
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
    botService,
    configDir,
    pluginsDir,
    eventBus,
    dbExplorer,
    messageRepo,
    pluginStore,
    persistPluginScope,
    authService,
  } = opts;

  const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 }); // 50 MB

  await app.register(cors, { origin: true });

  // ZIP / 二进制上传支持（插件安装用）
  app.addContentTypeParser(
    ["application/zip", "application/octet-stream", "application/x-zip-compressed"],
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body)
  );

  // 全局认证中间件
  app.addHook("preHandler", createAuthMiddleware(authService));

  // 认证路由（无需认证）
  await app.register(authRoutes, { authService });

  // 路由
  await app.register(healthRoutes, { logger, botService });
  await app.register(systemRoutes, { logger });
  await app.register(configRoutes, { logger, configDir });
  await app.register(eventRoutes, { logger, bus: eventBus });
  await app.register(dbRoutes, { logger, explorer: dbExplorer });
  await app.register(pluginRoutes, {
    logger,
    pluginsDir,
    persistPluginScope,
    botService,
    pluginStore,
  });
  await app.register(botRoutes, { logger, configDir });
  if (messageRepo) {
    await app.register(statsRoutes, { messageRepo, botService });
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
