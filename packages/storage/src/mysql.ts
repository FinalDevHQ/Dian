import mysql2 from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import type { LogEntry, LogQueryParams, LogRepository } from "./types.js";

// ---------------------------------------------------------------------------
// MySQL 日志仓库
// ---------------------------------------------------------------------------

export class MysqlLogRepository implements LogRepository {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = mysql2.createPool(connectionString);
  }

  async init(): Promise<void> {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS logs (
        id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
        bot_id     VARCHAR(64)  NOT NULL,
        level      VARCHAR(10)  NOT NULL,
        message    TEXT         NOT NULL,
        meta       JSON,
        created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_bot_id (bot_id),
        INDEX idx_level (level),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  async write(entry: LogEntry): Promise<void> {
    await this.pool.execute(
      `INSERT INTO logs (bot_id, level, message, meta) VALUES (?, ?, ?, ?)`,
      [
        entry.botId,
        entry.level,
        entry.message,
        entry.meta ? JSON.stringify(entry.meta) : null,
      ],
    );
  }

  async query(params: LogQueryParams): Promise<LogEntry[]> {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (params.botId) {
      conditions.push("bot_id = ?");
      bindings.push(params.botId);
    }
    if (params.level) {
      conditions.push("level = ?");
      bindings.push(params.level);
    }
    if (params.from) {
      conditions.push("created_at >= ?");
      bindings.push(params.from);
    }
    if (params.to) {
      conditions.push("created_at <= ?");
      bindings.push(params.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = params.limit ?? 100;
    const offset = params.offset ?? 0;
    bindings.push(limit, offset);

    const [rows] = await this.pool.execute<mysql2.RowDataPacket[]>(
      `SELECT id, bot_id, level, message, meta, created_at
       FROM logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bindings as any,
    );

    return rows.map((r) => ({
      id: r.id as number,
      botId: r.bot_id as string,
      level: r.level as LogEntry["level"],
      message: r.message as string,
      meta: r.meta as Record<string, unknown> | undefined,
      createdAt: new Date(r.created_at as string),
    }));
  }

  async cleanup(retentionDays: number): Promise<void> {
    await this.pool.execute(
      `DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [retentionDays],
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
