import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { LogService } from "@myfinal/logger";
import { BotConfigSchema, BotEntrySchema, parseYaml, writeYamlFile, type BotEntry } from "@myfinal/config";

interface BotRoutesOptions {
  configDir: string;
  logger: LogService;
}

/**
 * Bot 配置路由（单 bot 模式）：
 *   GET    /bot          — 读取 bot 完整配置
 *   PUT    /bot          — 更新 bot 完整配置
 *   PUT    /bot/enabled  — 切换连接开关
 *
 * 实现策略：直接重写 bot.yaml；ConfigService 的 chokidar watcher
 * 会触发 reload，BotService 会重启连接（被 disabled 的会被跳过）。
 *
 * ⚠️ 已知限制：用 js-yaml.dump 重写会丢失原文件中的注释。
 */
export async function botRoutes(
  app: FastifyInstance,
  opts: BotRoutesOptions,
): Promise<void> {
  const { configDir, logger } = opts;
  const botFile = resolve(configDir, "bot.yaml");

  async function readBot(): Promise<BotEntry> {
    const raw = await readFile(botFile, "utf8");
    const parsed = parseYaml(raw);
    const result = BotConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `bot.yaml 校验失败: ${result.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    return result.data.bot;
  }

  async function writeBot(bot: BotEntry): Promise<void> {
    // 校验后再写
    const ok = BotConfigSchema.safeParse({ bot });
    if (!ok.success) {
      throw new Error(
        `bot.yaml 写入前校验失败: ${ok.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    await writeYamlFile(botFile, { bot: ok.data.bot });
  }

  // ── GET /bot ─────────────────────────────────────────────────────────────
  app.get("/bot", async (_req, reply) => {
    try {
      const bot = await readBot();
      return reply.send({ bot });
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  // ── PUT /bot ──────────────────────────────────────────────────────────────
  // 整条替换。请求 body 必须是完整的 BotEntry。
  app.put<{ Body: unknown }>("/bot", async (req, reply) => {
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

    try {
      await writeBot(parsed.data);
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }

    logger.info(`Bot updated: ${parsed.data.botId}`);
    return reply.send({ ok: true, bot: parsed.data });
  });

  // ── PUT /bot/enabled ──────────────────────────────────────────────────────
  app.put<{ Body: { enabled: unknown } }>(
    "/bot/enabled",
    async (req, reply) => {
      const enabled = req.body?.enabled;
      if (typeof enabled !== "boolean") {
        return reply.code(400).send({ error: "enabled must be boolean" });
      }

      let bot: BotEntry;
      try {
        bot = await readBot();
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      bot = { ...bot, enabled };
      try {
        await writeBot(bot);
      } catch (err) {
        return reply.code(500).send({ error: (err as Error).message });
      }

      logger.info(`Bot ${bot.botId} ${enabled ? "enabled" : "disabled"}`);
      return reply.send({ ok: true });
    },
  );
}
