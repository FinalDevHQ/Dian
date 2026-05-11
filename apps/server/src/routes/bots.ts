import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { LogService } from "@dian/logger";
import { BotsSchema, BotEntrySchema, parseYaml, writeYamlFile, type BotEntry } from "@dian/config";

interface BotsRoutesOptions {
  configDir: string;
  logger: LogService;
}

/**
 * Bot CRUD 路由：
 *   GET    /bots                — 列出所有 bot 完整配置
 *   GET    /bots/:botId         — 读取单个 bot 完整配置（用于编辑表单回填）
 *   POST   /bots                — 添加新 bot（写入 bot.yaml）
 *   PUT    /bots/:botId         — 替换 bot 完整配置（支持改名）
 *   DELETE /bots/:botId         — 删除指定 bot
 *   PUT    /bots/:botId/enabled — 切换连接开关（program-level on/off）
 *
 * 实现策略：直接重写 bot.yaml；ConfigService 的 chokidar watcher
 * 会触发 reload，BotManager 会重启所有连接（被 disabled 的会被跳过）。
 *
 * ⚠️ 已知限制：用 js-yaml.dump 重写会丢失原文件中的注释。
 */
export async function botsRoutes(
  app: FastifyInstance,
  opts: BotsRoutesOptions,
): Promise<void> {
  const { configDir, logger } = opts;
  const botFile = resolve(configDir, "bot.yaml");

  async function readBots(): Promise<BotEntry[]> {
    const raw = await readFile(botFile, "utf8");
    const parsed = parseYaml(raw);
    const result = BotsSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `bot.yaml 校验失败: ${result.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    return result.data.bots;
  }

  async function writeBots(bots: BotEntry[]): Promise<void> {
    // 校验后再写
    const ok = BotsSchema.safeParse({ bots });
    if (!ok.success) {
      throw new Error(
        `bot.yaml 写入前校验失败: ${ok.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    await writeYamlFile(botFile, { bots: ok.data.bots });
  }

  // ── GET /bots ─────────────────────────────────────────────────────────────
  app.get("/bots", async (_req, reply) => {
    try {
      const list = await readBots();
      return reply.send({ bots: list });
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  // ── GET /bots/:botId ──────────────────────────────────────────────────────
  app.get<{ Params: { botId: string } }>(
    "/bots/:botId",
    async (req, reply) => {
      const target = decodeURIComponent(req.params.botId);
      let list: BotEntry[];
      try {
        list = await readBots();
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }
      const entry = list.find((b) => b.botId === target);
      if (!entry) {
        return reply.code(404).send({ error: `bot "${target}" not found` });
      }
      return reply.send({ bot: entry });
    },
  );

  // ── POST /bots ────────────────────────────────────────────────────────────
  app.post<{ Body: unknown }>("/bots", async (req, reply) => {
    // 单条 bot 校验：直接用 BotsSchema 包一层
    const single = BotEntrySchema.safeParse(req.body);
    if (!single.success) {
      return reply.code(400).send({
        error: "bot 配置校验失败",
        details: single.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    let list: BotEntry[];
    try {
      list = await readBots();
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }

    if (list.some((b) => b.botId === single.data.botId)) {
      return reply.code(409).send({
        error: `botId "${single.data.botId}" 已存在`,
      });
    }

    list.push(single.data);
    try {
      await writeBots(list);
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }

    logger.info(`Bot added: ${single.data.botId}`);
    return reply.send({ ok: true, bot: single.data });
  });

  // ── DELETE /bots/:botId ───────────────────────────────────────────────────
  app.delete<{ Params: { botId: string } }>(
    "/bots/:botId",
    async (req, reply) => {
      const target = decodeURIComponent(req.params.botId);
      let list: BotEntry[];
      try {
        list = await readBots();
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      const next = list.filter((b) => b.botId !== target);
      if (next.length === list.length) {
        return reply.code(404).send({ error: `bot "${target}" not found` });
      }
      if (next.length === 0) {
        return reply.code(400).send({
          error: "至少需要保留一个 bot（schema 限制）",
        });
      }

      try {
        await writeBots(next);
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      logger.info(`Bot deleted: ${target}`);
      return reply.send({ ok: true });
    },
  );

  // ── PUT /bots/:botId ──────────────────────────────────────────────────────
  // 整条替换（编辑）。请求 body 必须是完整的 BotEntry。
  // 允许改名：若 body.botId !== path :botId，按 path 找到原条目然后替换为新 botId；
  // 但新 botId 不能与其它已存在的 botId 重复。
  app.put<{ Params: { botId: string }; Body: unknown }>(
    "/bots/:botId",
    async (req, reply) => {
      const target = decodeURIComponent(req.params.botId);

      const parsed = BotEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "bot 配置校验失败",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }

      let list: BotEntry[];
      try {
        list = await readBots();
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      const idx = list.findIndex((b) => b.botId === target);
      if (idx < 0) {
        return reply.code(404).send({ error: `bot "${target}" not found` });
      }

      // 改名场景：新名字不能与其它现有 bot 冲突
      if (
        parsed.data.botId !== target &&
        list.some((b, i) => i !== idx && b.botId === parsed.data.botId)
      ) {
        return reply.code(409).send({
          error: `botId "${parsed.data.botId}" 已存在`,
        });
      }

      list[idx] = parsed.data;
      try {
        await writeBots(list);
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      logger.info(
        target === parsed.data.botId
          ? `Bot updated: ${target}`
          : `Bot updated: ${target} -> ${parsed.data.botId}`,
      );
      return reply.send({ ok: true, bot: parsed.data });
    },
  );

  // ── PUT /bots/:botId/enabled ──────────────────────────────────────────────
  app.put<{ Params: { botId: string }; Body: { enabled: unknown } }>(
    "/bots/:botId/enabled",
    async (req, reply) => {
      const target = decodeURIComponent(req.params.botId);
      const enabled = req.body?.enabled;
      if (typeof enabled !== "boolean") {
        return reply.code(400).send({ error: "enabled must be boolean" });
      }

      let list: BotEntry[];
      try {
        list = await readBots();
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      const idx = list.findIndex((b) => b.botId === target);
      if (idx < 0) {
        return reply.code(404).send({ error: `bot "${target}" not found` });
      }

      list[idx] = { ...list[idx], enabled };
      try {
        await writeBots(list);
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      logger.info(`Bot ${target} ${enabled ? "enabled" : "disabled"}`);
      return reply.send({ ok: true });
    },
  );
}
