import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * SQLite 插件存储实现
 * 为每个插件创建独立的表，表名由插件自行定义（建议格式：插件名_功能名）
 */
export class SqlitePluginStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const absPath = resolve(dbPath);
    mkdirSync(dirname(absPath), { recursive: true });
    this.db = new Database(absPath);
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * 创建插件专属表
   * @param tableName 完整表名
   * @param columns 列定义
   */
  async createTable(tableName: string, columns: string[]): Promise<void> {
    const columnsDef = columns.join(", ");
    this.db.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${columnsDef},
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
    )`);
  }

  /**
   * 插入数据
   */
  async insert(tableName: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => "?").join(", ");
    const values = Object.values(data);
    
    this.db.prepare(
      `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`
    ).run(...values);
  }

  /**
   * 查询数据
   */
  async query(tableName: string, params?: Record<string, unknown>, options?: {
    limit?: number;
    orderBy?: string;
    order?: "ASC" | "DESC";
  }): Promise<Record<string, unknown>[]> {
    let sql = `SELECT * FROM ${tableName}`;
    const bindings: unknown[] = [];
    
    if (params && Object.keys(params).length > 0) {
      const conditions = Object.entries(params).map(([key, value]) => {
        if (value === null) return `${key} IS NULL`;
        bindings.push(value);
        return `${key} = ?`;
      });
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy} ${options.order || "DESC"}`;
    }
    
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    return this.db.prepare(sql).all(...bindings) as Record<string, unknown>[];
  }

  /**
   * 删除数据
   */
  async delete(tableName: string, params?: Record<string, unknown>): Promise<number> {
    let sql = `DELETE FROM ${tableName}`;
    const bindings: unknown[] = [];
    
    if (params && Object.keys(params).length > 0) {
      const conditions = Object.entries(params).map(([key, value]) => {
        if (value === null) return `${key} IS NULL`;
        bindings.push(value);
        return `${key} = ?`;
      });
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    const result = this.db.prepare(sql).run(...bindings);
    return result.changes;
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.db.close();
  }
}
