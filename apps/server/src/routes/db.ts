import type { FastifyInstance } from "fastify";
import type { LogService } from "@myfinal/logger";
import type { DatabaseExplorer } from "../db/explorer.js";

interface DbRoutesOptions {
  explorer: DatabaseExplorer;
  logger: LogService;
}

const DANGEROUS_SQL_PATTERNS = [
  /^\s*DROP\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*ALTER\s+/i,
  /^\s*CREATE\s+/i,
  /^\s*ATTACH\s+/i,
  /^\s*DETACH\s+/i,
];

function isDangerousSql(sql: string): boolean {
  return DANGEROUS_SQL_PATTERNS.some((pattern) => pattern.test(sql));
}

export async function dbRoutes(
  app: FastifyInstance,
  opts: DbRoutesOptions
): Promise<void> {
  const { explorer, logger } = opts;
  const allowWrites = process.env.DB_ALLOW_WRITES === "true";

  app.get("/db/sources", async (_req, reply) => {
    return reply.send({ sources: explorer.listSources() });
  });

  app.get<{ Params: { name: string } }>(
    "/db/sources/:name/tables",
    async (req, reply) => {
      try {
        return reply.send({ tables: explorer.listTables(req.params.name) });
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    }
  );

  app.get<{ Params: { name: string; table: string } }>(
    "/db/sources/:name/tables/:table/schema",
    async (req, reply) => {
      try {
        return reply.send({
          columns: explorer.getSchema(req.params.name, req.params.table),
        });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  app.post<{
    Params: { name: string };
    Body: { sql: string; params?: unknown[]; readOnly?: boolean };
  }>("/db/sources/:name/query", async (req, reply) => {
    const { sql, params, readOnly } = req.body ?? {};
    if (!sql || typeof sql !== "string") {
      return reply.code(400).send({ error: "sql is required" });
    }

    const effectiveReadOnly = readOnly ?? true;

    if (!effectiveReadOnly && !allowWrites) {
      return reply.code(403).send({
        error: "写操作已禁用。如需启用，请设置环境变量 DB_ALLOW_WRITES=true",
      });
    }

    if (!effectiveReadOnly && isDangerousSql(sql)) {
      return reply.code(403).send({
        error: "危险 SQL 语句被拒绝（DROP/TRUNCATE/ALTER/CREATE/ATTACH/DETACH）",
      });
    }

    try {
      const result = explorer.query(req.params.name, sql, params ?? [], {
        readOnly: effectiveReadOnly,
      });
      return reply.send(result);
    } catch (err) {
      const msg = (err as Error).message;
      logger.warn("DB query failed", { sql, msg });
      return reply.code(400).send({ error: msg });
    }
  });
}
