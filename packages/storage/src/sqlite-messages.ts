import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type {
  GroupStat,
  MessageEntry,
  MessageRepository,
  OverviewStats,
  StatsFilter,
  TrendPoint,
  UserStat,
} from "./types.js";

export class SqliteMessageRepository implements MessageRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    const absPath = resolve(dbPath);
    mkdirSync(dirname(absPath), { recursive: true });
    this.db = new Database(absPath);
    this.db.pragma("journal_mode = WAL");
    this._migrate();
  }

  private _migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id    TEXT    NOT NULL UNIQUE,
        bot_id      TEXT    NOT NULL,
        subtype     TEXT    NOT NULL,
        group_id    TEXT,
        user_id     TEXT,
        sender_name TEXT,
        message_id  TEXT,
        text        TEXT,
        timestamp   INTEGER NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_msg_bot_id    ON messages(bot_id);
      CREATE INDEX IF NOT EXISTS idx_msg_group_id  ON messages(group_id);
      CREATE INDEX IF NOT EXISTS idx_msg_user_id   ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_msg_timestamp ON messages(timestamp);
    `);
  }

  async writeMessage(entry: MessageEntry): Promise<void> {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO messages
           (event_id, bot_id, subtype, group_id, user_id, sender_name, message_id, text, timestamp)
         VALUES
           (@eventId, @botId, @subtype, @groupId, @userId, @senderName, @messageId, @text, @timestamp)`
      )
      .run({
        eventId:    entry.eventId,
        botId:      entry.botId,
        subtype:    entry.subtype,
        groupId:    entry.groupId ?? null,
        userId:     entry.userId ?? null,
        senderName: entry.senderName ?? null,
        messageId:  entry.messageId ?? null,
        text:       entry.text ?? null,
        timestamp:  entry.timestamp,
      });
  }

  async overviewStats(filter: StatsFilter): Promise<OverviewStats> {
    const { where, bindings } = this._buildWhere(filter);

    const row = this.db
      .prepare(
        `SELECT COUNT(*) as total,
                COUNT(DISTINCT group_id) as groups,
                COUNT(DISTINCT user_id)  as users
         FROM messages ${where}`
      )
      .get(bindings) as { total: number; groups: number; users: number };

    const byBot = this.db
      .prepare(
        `SELECT bot_id as botId, COUNT(*) as count
         FROM messages ${where}
         GROUP BY bot_id ORDER BY count DESC`
      )
      .all(bindings) as { botId: string; count: number }[];

    return { total: row.total, groups: row.groups, users: row.users, byBot };
  }

  async groupStats(
    filter: StatsFilter & { limit?: number }
  ): Promise<GroupStat[]> {
    const { where, bindings } = this._buildWhere(filter);
    const limit = filter.limit ?? 20;

    return this.db
      .prepare(
        `SELECT group_id as groupId, COUNT(*) as count, MAX(timestamp) as lastAt
         FROM messages ${where} AND group_id IS NOT NULL
         GROUP BY group_id ORDER BY count DESC LIMIT @limit`
      )
      .all({ ...bindings, limit }) as GroupStat[];
  }

  async userStats(
    filter: StatsFilter & { limit?: number; groupId?: string }
  ): Promise<UserStat[]> {
    const extraFilter: StatsFilter = { ...filter };
    if (filter.groupId) extraFilter.groupId = filter.groupId;
    const { where, bindings } = this._buildWhere(extraFilter);
    const limit = filter.limit ?? 20;

    return this.db
      .prepare(
        `SELECT user_id as userId,
                MAX(sender_name) as senderName,
                COUNT(*) as count,
                MAX(timestamp) as lastAt
         FROM messages ${where} AND user_id IS NOT NULL
         GROUP BY user_id ORDER BY count DESC LIMIT @limit`
      )
      .all({ ...bindings, limit }) as UserStat[];
  }

  async trendStats(filter: StatsFilter): Promise<TrendPoint[]> {
    const { where, bindings } = this._buildWhere(filter);

    return this.db
      .prepare(
        `SELECT strftime('%Y-%m-%d', datetime(timestamp, 'unixepoch')) as date,
                COUNT(*) as count
         FROM messages ${where}
         GROUP BY date ORDER BY date ASC`
      )
      .all(bindings) as TrendPoint[];
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // ---------------------------------------------------------------------------
  // 内部：WHERE 构建（注意 groupStats 里会追加 AND group_id IS NOT NULL）
  // ---------------------------------------------------------------------------
  private _buildWhere(filter: StatsFilter): {
    where: string;
    bindings: Record<string, unknown>;
  } {
    const conds: string[] = [];
    const bindings: Record<string, unknown> = {};

    if (filter.botId) {
      conds.push("bot_id = @botId");
      bindings.botId = filter.botId;
    }
    if (filter.groupId) {
      conds.push("group_id = @groupId");
      bindings.groupId = filter.groupId;
    }
    if (filter.from != null) {
      conds.push("timestamp >= @from");
      bindings.from = filter.from;
    }
    if (filter.to != null) {
      conds.push("timestamp <= @to");
      bindings.to = filter.to;
    }

    // 始终至少 WHERE 1=1，方便 groupStats 拼接 AND
    const where = conds.length
      ? `WHERE ${conds.join(" AND ")}`
      : "WHERE 1=1";

    return { where, bindings };
  }
}
