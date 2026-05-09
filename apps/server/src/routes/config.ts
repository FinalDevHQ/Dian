import type { FastifyInstance } from "fastify";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { LogService } from "@dian/logger";

const ALLOWED_FILE = /^[a-zA-Z0-9._-]+\.ya?ml$/;

interface ConfigRoutesOptions {
  configDir: string;
  logger: LogService;
}

/**
 * 注册配置文件管理路由
 *
 * GET    /config/files            — 列出 config/ 目录下的 *.yaml 文件
 * GET    /config/files/:name      — 读取单个文件内容
 * PUT    /config/files/:name      — 覆盖写入单个文件（body: { content }）
 *
 * 写入后由 ConfigService 的 fs.watch 自动触发热重载。
 */
export async function configRoutes(
  app: FastifyInstance,
  opts: ConfigRoutesOptions
): Promise<void> {
  const { configDir, logger } = opts;
  const rootAbs = resolve(configDir);

  function safePath(name: string): string | null {
    if (!ALLOWED_FILE.test(name)) return null;
    const full = resolve(rootAbs, name);
    // 防止通过文件名跳出 configDir
    if (full !== rootAbs && !full.startsWith(rootAbs + sep)) return null;
    return full;
  }

  app.get("/config/files", async (_req, reply) => {
    const entries = await readdir(rootAbs, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((e) => e.isFile() && ALLOWED_FILE.test(e.name))
        .map(async (e) => {
          const s = await stat(join(rootAbs, e.name));
          return {
            name: e.name,
            size: s.size,
            modifiedMs: s.mtimeMs,
          };
        })
    );
    files.sort((a, b) => a.name.localeCompare(b.name));
    return reply.send({ files });
  });

  app.get<{ Params: { name: string } }>(
    "/config/files/:name",
    async (req, reply) => {
      const p = safePath(req.params.name);
      if (!p) return reply.code(400).send({ error: "invalid filename" });
      try {
        const [content, s] = await Promise.all([
          readFile(p, "utf8"),
          stat(p),
        ]);
        return reply.send({
          name: req.params.name,
          content,
          size: s.size,
          modifiedMs: s.mtimeMs,
        });
      } catch {
        return reply.code(404).send({ error: "file not found" });
      }
    }
  );

  app.put<{ Params: { name: string }; Body: { content: string } }>(
    "/config/files/:name",
    async (req, reply) => {
      const p = safePath(req.params.name);
      if (!p) return reply.code(400).send({ error: "invalid filename" });
      const body = req.body;
      if (!body || typeof body.content !== "string") {
        return reply.code(400).send({ error: "content must be string" });
      }
      try {
        await writeFile(p, body.content, "utf8");
        const s = await stat(p);
        logger.info(`Config file written: ${req.params.name}`);
        return reply.send({
          name: req.params.name,
          size: s.size,
          modifiedMs: s.mtimeMs,
        });
      } catch (err) {
        logger.error("Failed to write config file", { err });
        return reply.code(500).send({ error: "write failed" });
      }
    }
  );
}
