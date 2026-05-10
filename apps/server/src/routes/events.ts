import type { FastifyInstance } from "fastify";
import type { LogService } from "@dian/logger";
import type { BotEvent } from "@dian/shared";
import type { EventBus } from "../event/event-bus.js";

interface EventRoutesOptions {
  bus: EventBus;
  logger: LogService;
}

interface ListQuery {
  limit?: string;
  botId?: string;
  type?: string;
}

interface StreamQuery {
  botId?: string;
  type?: string;
}

function matches(
  event: BotEvent,
  filter: { botId?: string; type?: string }
): boolean {
  if (filter.botId && event.botId !== filter.botId) return false;
  if (filter.type && event.type !== filter.type) return false;
  return true;
}

/**
 * 注册事件流路由
 *
 * GET /events/recent  — 拉取最近事件（一次性 JSON）
 * GET /events/stream  — SSE 实时事件流
 *
 * 查询参数：
 *  - botId : 仅返回该 botId 的事件
 *  - type  : 仅返回该 type 的事件（message / notice / request 等）
 *  - limit : recent 接口可用，默认 100，上限 200
 */
export async function eventRoutes(
  app: FastifyInstance,
  opts: EventRoutesOptions
): Promise<void> {
  const { bus, logger } = opts;

  app.get<{ Querystring: ListQuery }>(
    "/events/recent",
    async (req, reply) => {
      const { limit, botId, type } = req.query;
      const n = Math.min(Number(limit ?? 100) || 100, 200);
      const all = bus.getHistory();
      const filtered = all.filter((e) => matches(e, { botId, type }));
      const out = filtered.slice(-n);
      return reply.send({ events: out });
    }
  );

  app.get<{ Querystring: StreamQuery }>(
    "/events/stream",
    async (req, reply) => {
      const { botId, type } = req.query;

      // 切换为原生 SSE 响应
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      reply.raw.write(": connected\n\n");

      const send = (data: unknown) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // 写失败说明连接已断
        }
      };

      // 发送一个 hello 让客户端知道连上了
      send({ kind: "hello", ts: Date.now() });

      // 心跳：每 25s 发一次注释行，防止反向代理空闲断开
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: ping ${Date.now()}\n\n`);
        } catch {
          /* noop */
        }
      }, 25_000);

      const unsubscribe = bus.subscribe((event) => {
        if (matches(event, { botId, type })) {
          send({ kind: "event", event });
        }
      });

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          reply.raw.end();
        } catch {
          /* noop */
        }
        logger.debug("SSE client disconnected");
      };

      req.raw.on("close", cleanup);
      req.raw.on("error", cleanup);

      // fastify 的 reply 必须返回点东西或保持挂起；用 reply.hijack 接管
      reply.hijack();
    }
  );
}
