import type { FastifyInstance } from "fastify";
import type { LogService } from "@dian/logger";
import type { BotManager } from "../bot/bot-manager.js";

/**
 * 注册健康检查与状态路由
 */
export async function healthRoutes(
  app: FastifyInstance,
  opts: { logger: LogService; botManager: BotManager }
): Promise<void> {
  // GET /health — 进程存活探针
  app.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok", ts: Date.now() });
  });

  // GET /status — 机器人状态
  app.get("/status", async (_req, reply) => {
    const bots = opts.botManager.getBots().map((b) => ({
      botId: b.botId,
    }));
    return reply.send({ bots });
  });
}
