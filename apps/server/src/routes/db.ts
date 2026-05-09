import type { FastifyInstance } from "fastify";
import type { LogService } from "@dian/logger";
import type { DatabaseExplorer } from "../db/explorer.js";

interface DbRoutesOptions {
  explorer: DatabaseExplorer;
  logger: LogService;
}

export async function dbRoutes(
  app: FastifyInstance,
  opts: DbRoutesOptions
): Promise<void> {
  const { explorer, logger } = opts;

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
    try {
      const result = explorer.query(req.params.name, sql, params ?? [], {
        readOnly,
      });
      return reply.send(result);
    } catch (err) {
      const msg = (err as Error).message;
      logger.warn("DB query failed", { sql, msg });
      return reply.code(400).send({ error: msg });
    }
  });
}
