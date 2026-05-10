import type { FastifyInstance } from "fastify";
import type { MessageRepository } from "@dian/storage";
import type { BotManager } from "../bot/bot-manager.js";

interface StatsRoutesOptions {
  messageRepo: MessageRepository;
  botManager: BotManager;
}

function parseFilter(query: Record<string, string | undefined>) {
  const filter: { botId?: string; groupId?: string; from?: number; to?: number } = {};
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
  const { messageRepo, botManager } = opts;

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

  // ── GET /stats/group-names ────────────────────────────────────────────────
  // 返回已缓存的群名映射 { groupId: name, ... }
  // 可选 ?groupIds=123,456 过滤
  app.get<{ Querystring: { groupIds?: string } }>(
    "/stats/group-names",
    async (req, reply) => {
      const { groupIds } = req.query as { groupIds?: string };
      const ids = groupIds ? groupIds.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const entries = await messageRepo.getGroupNames(ids.length ? ids : undefined);
      const map: Record<string, string> = {};
      for (const e of entries) map[e.groupId] = e.name;
      return reply.send(map);
    }
  );

  // ── POST /stats/group-names/sync ──────────────────────────────────────────
  // 向所有活跃 bot 请求 get_group_list，将结果写入 group_names 缓存
  app.post("/stats/group-names/sync", async (_req, reply) => {
    const bots = botManager.getBots();
    let synced = 0;

    await Promise.allSettled(
      bots.map(async (bot) => {
        try {
          const result = await bot.sendAction<
            { group_id: number; group_name: string }[]
          >({ action: "get_group_list", params: {} });

          if (result.status === "ok" && Array.isArray(result.data)) {
            const entries = result.data.map((g) => ({
              groupId: String(g.group_id),
              name:    g.group_name ?? String(g.group_id),
            }));
            await messageRepo.upsertGroupNames(entries);
            synced += entries.length;
          }
        } catch {
          // 单个 bot 失败不影响其他 bot
        }
      })
    );

    return reply.send({ ok: true, synced });
  });
}
