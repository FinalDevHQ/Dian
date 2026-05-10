import { existsSync, createReadStream, statSync } from "node:fs";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { unzip } from "fflate";
import { pluginManager } from "@dian/plugin-runtime";
import type { LogService } from "@dian/logger";

// 静态资源 MIME 类型表（够用即可，无需引入 mime 库）
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm":  "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
};

interface PluginRoutesOptions {
  logger: LogService;
  pluginsDir: string;
  /** 已知的 botId 列表，用于校验 PUT /plugins/:name/bots 提交的值 */
  knownBotIds: () => string[];
  /** 持久化插件 bot 白名单到磁盘 */
  persistPluginScope: () => Promise<void>;
}

export async function pluginRoutes(
  app: FastifyInstance,
  opts: PluginRoutesOptions
): Promise<void> {
  const { logger, pluginsDir, knownBotIds, persistPluginScope } = opts;

  // ── GET /plugins ──────────────────────────────────────────────────────────
  app.get("/plugins", async (_req, reply) => {
    return reply.send({ plugins: pluginManager.listPluginsMeta() });
  });

  // ── PUT /plugins/:name/enabled ─────────────────────────────────────────────
  app.put<{
    Params: { name: string };
    Body: { enabled: boolean };
  }>("/plugins/:name/enabled", async (req, reply) => {
    const { name } = req.params;
    const { enabled } = req.body ?? {};
    if (typeof enabled !== "boolean") {
      return reply.code(400).send({ error: "enabled must be boolean" });
    }
    if (enabled) {
      pluginManager.removeFromBlacklist(name);
    } else {
      pluginManager.addToBlacklist(name);
    }
    logger.info(`Plugin ${name} ${enabled ? "enabled" : "disabled"}`);
    return reply.send({ ok: true });
  });

  // ── PUT /plugins/:name/bots ────────────────────────────────────────────────
  // body: { bots: string[] }
  // 设置插件的 bot 白名单（默认空 = 任何 bot 都不响应）
  app.put<{
    Params: { name: string };
    Body: { bots: unknown };
  }>("/plugins/:name/bots", async (req, reply) => {
    const { name } = req.params;
    const { bots } = req.body ?? {};

    if (!Array.isArray(bots) || !bots.every((b) => typeof b === "string")) {
      return reply.code(400).send({ error: "bots must be string[]" });
    }

    // 插件需已加载
    const exists = pluginManager.plugins.some((p) => p.meta.name === name);
    if (!exists) {
      return reply.code(404).send({ error: `plugin "${name}" not found` });
    }

    // 过滤掉未知 botId，避免脏数据
    const valid = new Set(knownBotIds());
    const accepted = (bots as string[]).filter((b) => valid.has(b));
    const rejected = (bots as string[]).filter((b) => !valid.has(b));

    pluginManager.setPluginBots(name, accepted);
    await persistPluginScope();

    logger.info(`Plugin ${name} bots scope updated`, { accepted, rejected });
    return reply.send({ ok: true, bots: accepted, rejected });
  });

  // ── DELETE /plugins/:name ──────────────────────────────────────────────────
  app.delete<{ Params: { name: string } }>("/plugins/:name", async (req, reply) => {
    const { name } = req.params;
    if (!name || !/^[\w-]+$/.test(name)) {
      return reply.code(400).send({ error: "invalid plugin name" });
    }

    // 必须在 unload 之前先拿到 filePath，
    // 否则 plugins.find 会返回 undefined；且 meta.name 与目录名常不一致。
    const loadedPlugin = pluginManager.plugins.find((p) => p.meta.name === name);
    const loadedFilePath = loadedPlugin?.filePath;

    // 从内存卸载
    pluginManager.unload(name);
    // 同步清掉黑名单状态，避免重装后仍处于禁用
    pluginManager.removeFromBlacklist(name);

    // 计算真实目标：优先用已加载插件的实际路径
    const targetDir  = loadedFilePath ? dirname(loadedFilePath) : join(pluginsDir, name);
    const targetFile = loadedFilePath && loadedFilePath.endsWith(".js")
      ? loadedFilePath
      : join(pluginsDir, `${name}.js`);

    try {
      let removed = false;
      // 单文件插件（plugins/foo.js）：父目录就是 pluginsDir，只删文件
      if (targetDir === resolve(pluginsDir)) {
        if (existsSync(targetFile)) {
          await unlink(targetFile);
          removed = true;
        }
      } else if (existsSync(targetDir)) {
        await rm(targetDir, { recursive: true, force: true });
        removed = true;
      } else if (existsSync(targetFile)) {
        await unlink(targetFile);
        removed = true;
      }

      if (!removed) {
        logger.warn(`Plugin "${name}" unloaded from memory, but no files were found to delete (targetDir=${targetDir})`);
        return reply.code(404).send({
          error: `plugin "${name}" not found on disk`,
          hint: "插件已从内存卸载，但磁盘上未找到对应目录或文件",
        });
      }

      logger.info(`Plugin uninstalled: ${name}`);
      return reply.send({ ok: true });
    } catch (err) {
      logger.error(`Failed to uninstall plugin: ${name}`, { err: (err as Error).message });
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  // ── POST /plugins/upload ─────────────────────────────────────────────────
  app.post<{
    Querystring: { name?: string };
    Body: Buffer;
  }>("/plugins/upload", async (req, reply) => {
    const rawName = req.query.name ?? "";
    const name = rawName.trim().replace(/\.zip$/i, "");

    if (!name || !/^[\w-]+$/.test(name)) {
      return reply.code(400).send({ error: "missing or invalid ?name= (alphanumeric / dash / underscore only)" });
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply.code(400).send({ error: "empty body" });
    }

    const destDir = join(pluginsDir, name);

    try {
      await mkdir(destDir, { recursive: true });

      // 使用 fflate 解压 ZIP（纯 JS，跨平台无需 PowerShell）
      await new Promise<void>((res, rej) => {
        unzip(new Uint8Array(body), async (err, files) => {
          if (err) { rej(err); return; }
          try {
            for (const [filePath, data] of Object.entries(files)) {
              // 跳过目录条目（fflate 中目录条目 data 长度为 0 且路径以 / 结尾）
              if (filePath.endsWith("/")) continue;
              const dest = join(destDir, filePath);
              await mkdir(dirname(dest), { recursive: true });
              await writeFile(dest, data);
            }
            res();
          } catch (writeErr) {
            rej(writeErr);
          }
        });
      });

      logger.info(`Plugin installed: ${name} -> ${destDir}`);
      return reply.send({ ok: true, name, destDir });
    } catch (err) {
      logger.error(`Plugin install failed: ${name}`, { err: (err as Error).message });
      return reply.code(500).send({ error: (err as Error).message });
    }
  });

  // ── 插件 API（catch-all，热插拔无需重启） ────────────────────────────────
  // 关键设计：不再为每个 plugin/route 单独 app.route()（那样卸载/重载会撞重复注册），
  // 而是注册一个通配 handler，根据请求 URL 在内存中查找当前已加载插件 + 路由实例。
  const apiHandler = async (req: import("fastify").FastifyRequest, reply: FastifyReply) => {
    const { name, '*': rest } = req.params as { name: string; "*": string };
    const subPath = `/${rest ?? ""}`.replace(/\/+$/, "") || "/";

    const plugin = pluginManager.plugins.find((p) => p.meta.name === decodeURIComponent(name));
    if (!plugin) {
      return reply.code(404).send({ error: `plugin "${name}" not loaded` });
    }
    const route = plugin.routes.find(
      (r) => r.method === req.method && (r.path === subPath || r.path === subPath + "/" || r.path + "/" === subPath)
    );
    if (!route) {
      return reply.code(404).send({ error: `no ${req.method} ${subPath} on plugin "${plugin.meta.name}"` });
    }
    return route.handler(req, reply);
  };

  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
    app.route({ method, url: "/plugins/:name/api/*", handler: apiHandler });
    app.route({ method, url: "/plugins/:name/api",   handler: apiHandler });
  }

  // ── 插件静态 UI（/plugins/:name/ui/*，手动 serve，热插拔安全） ─────────────
  app.get<{ Params: { name: string; "*": string } }>(
    "/plugins/:name/ui/*",
    async (req, reply) => serveStatic(req.params.name, req.params["*"], reply, logger)
  );
  app.get<{ Params: { name: string } }>(
    "/plugins/:name/ui",
    async (req, reply) => reply.redirect(`/plugins/${encodeURIComponent(req.params.name)}/ui/`)
  );
  app.get<{ Params: { name: string } }>(
    "/plugins/:name/ui/",
    async (req, reply) => serveStatic(req.params.name, "", reply, logger)
  );

  // 已加载插件的状态/UI 注册情况打印（仅日志）
  for (const plugin of pluginManager.plugins) {
    logger.info(
      `Plugin ready: ${plugin.meta.name} (routes=${plugin.routes.length}, ui=${plugin.ui ? "yes" : "no"})`
    );
  }
}

/**
 * 根据当前已加载插件元信息，从插件的 staticDir 中读取并返回文件。
 * - 路径规范化，拒绝目录穿越。
 * - 找不到文件或插件未声明 UI 时返回 404。
 */
async function serveStatic(
  rawName: string,
  rawSubPath: string,
  reply: FastifyReply,
  logger: LogService
): Promise<FastifyReply> {
  const name = decodeURIComponent(rawName);
  const plugin = pluginManager.plugins.find((p) => p.meta.name === name);
  if (!plugin || !plugin.ui?.staticDir) {
    return reply.code(404).send({ error: `plugin "${name}" has no UI` });
  }

  const pluginDir = dirname(plugin.filePath);
  const staticRoot = resolve(pluginDir, plugin.ui.staticDir);
  const indexFile = plugin.ui.entry ?? "index.html";

  // 解码 + 规范化子路径，去掉首尾斜杠，空则视为 index
  const sub = decodeURIComponent(rawSubPath ?? "").replace(/^\/+|\/+$/g, "");
  const target = sub === "" ? indexFile : sub;

  // 防目录穿越：解析后的路径必须仍在 staticRoot 下
  const filePath = normalize(resolve(staticRoot, target));
  if (!filePath.startsWith(staticRoot + sep) && filePath !== staticRoot) {
    return reply.code(403).send({ error: "forbidden" });
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return reply.code(404).send({ error: "not found" });
  }
  // 目录请求 → 回退到 index 文件
  let finalPath = filePath;
  if (stat.isDirectory()) {
    finalPath = resolve(filePath, indexFile);
    try {
      stat = statSync(finalPath);
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  }

  const mime = MIME_TYPES[extname(finalPath).toLowerCase()] ?? "application/octet-stream";
  reply.header("Content-Type", mime);
  reply.header("Content-Length", stat.size);
  reply.header("Cache-Control", "no-cache");
  logger.debug?.(`[plugin-ui] ${name} -> ${finalPath}`);
  return reply.send(createReadStream(finalPath));
}
