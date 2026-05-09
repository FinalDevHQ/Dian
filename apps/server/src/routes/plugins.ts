import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { pluginManager } from "@dian/plugin-runtime";
import type { LogService } from "@dian/logger";

interface PluginRoutesOptions {
  logger: LogService;
}

export async function pluginRoutes(
  app: FastifyInstance,
  opts: PluginRoutesOptions
): Promise<void> {
  const { logger } = opts;

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

  // ── 插件自定义 API 路由（/plugins/:name/api/*） ────────────────────────────
  for (const plugin of pluginManager.plugins) {
    const { name } = plugin.meta;
    const prefix = `/plugins/${encodeURIComponent(name)}/api`;

    for (const route of plugin.routes) {
      const fullPath = `${prefix}${route.path}`;
      try {
        app.route({
          method: route.method,
          url: fullPath,
          handler: route.handler,
        });
        logger.info(`Registered plugin route: ${route.method} ${fullPath}`);
      } catch (err) {
        logger.warn(`Failed to register plugin route ${route.method} ${fullPath}`, {
          err: (err as Error).message,
        });
      }
    }

    // ── 插件静态 UI（/plugins/:name/ui/*） ──────────────────────────────────
    if (plugin.ui?.staticDir) {
      const pluginDir = dirname(plugin.filePath);
      const staticRoot = resolve(pluginDir, plugin.ui.staticDir);

      if (existsSync(staticRoot)) {
        try {
          await app.register(fastifyStatic, {
            root: staticRoot,
            prefix: `/plugins/${encodeURIComponent(name)}/ui/`,
            index: plugin.ui.entry ?? "index.html",
            decorateReply: false, // 允许多次注册
          });
          logger.info(`Serving plugin UI: /plugins/${name}/ui/ -> ${staticRoot}`);
        } catch (err) {
          logger.warn(`Failed to register plugin UI for ${name}`, {
            err: (err as Error).message,
          });
        }
      } else {
        logger.warn(`Plugin ${name} declared staticDir=${plugin.ui.staticDir} but it does not exist: ${staticRoot}`);
      }
    }
  }
}
