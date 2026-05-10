import type { FastifyInstance } from "fastify";
import type { MessageRepository, StatsFilter } from "@dian/storage";

interface StatsRoutesOptions {
  messageRepo: MessageRepository;
}

function parseFilter(query: Record<string, string | undefined>): StatsFilter {
  const filter: StatsFilter = {};
  if (query.botId)   filter.botId   = query.botId;
  if (query.groupId) filter.groupId = query.groupId;
  if (query.from)    filter.from    = Number(query.from);
  if (query.to)      filter.to      = Number(query.to);
  return filter;
}

export async function statsRoutes(
  app: FastifyInstance,
  opts: StatsRoutesOptions
): Promise<void> {
  const { messageRepo } = opts;

  type Q = { botId?: string; groupId?: string; from?: string; to?: string; limit?: string };

  // ── GET /stats/messages/overview ──────────────────────────────────────────
  app.get<{ Querystring: Q }>("/stats/messages/overview", async (req, reply) => {
    const filter = parseFilter(req.query as Record<string, string | undefined>);
    const data = await messageRepo.overviewStats(filter);
    return reply.send(data);
  });

  // ── GET /stats/messages/by-group ──────────────────────────────────────────
  app.get<{ Querystring: Q }>("/stats/messages/by-group", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const filter = parseFilter(q);
    const limit = q.limit ? Math.min(Number(q.limit), 50) : 20;
    const data = await messageRepo.groupStats({ ...filter, limit });
    return reply.send({ groups: data });
  });

  // ── GET /stats/messages/by-user ───────────────────────────────────────────
  app.get<{ Querystring: Q }>("/stats/messages/by-user", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const filter = parseFilter(q);
    const limit = q.limit ? Math.min(Number(q.limit), 50) : 20;
    const data = await messageRepo.userStats({ ...filter, limit });
    return reply.send({ users: data });
  });

  // ── GET /stats/messages/trend ─────────────────────────────────────────────
  app.get<{ Querystring: Q }>("/stats/messages/trend", async (req, reply) => {
    const filter = parseFilter(req.query as Record<string, string | undefined>);
    const data = await messageRepo.trendStats(filter);
    return reply.send({ trend: data });
  });
}
