import type { FastifyInstance } from "fastify";
import type { LogService } from "@myfinal/logger";
import type { BotService } from "../bot/bot-service.js";

/**
 * 注册健康检查与状态路由
 */
export async function healthRoutes(
  app: FastifyInstance,
  opts: { logger: LogService; botService: BotService }
): Promise<void> {
  // GET /health — 进程存活探针
  app.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok", ts: Date.now() });
  });

  // GET /status — 机器人状态
  app.get("/status", async (_req, reply) => {
    return reply.send({ bot: opts.botService.getBotState() });
  });
}
