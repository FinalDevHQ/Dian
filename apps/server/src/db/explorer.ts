import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LogService } from "@dian/logger";

export type DataSourceKind = "sqlite";

export interface DataSourceMeta {
  name: string;
  kind: DataSourceKind;
  /** 绝对路径或连接串（仅展示用） */
  location: string;
  ready: boolean;
}

interface SqliteSource {
  name: string;
  kind: "sqlite";
  file: string;
  db: Database.Database;
}

export interface TableInfo {
  name: string;
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  pk: boolean;
  defaultValue: unknown;
}

export interface QueryResult {
  columns: { name: string }[];
  rows: unknown[][];
  rowCount: number;
  truncated: boolean;
  rowsAffected?: number;
  lastInsertRowid?: number | string;
  durationMs: number;
}

const HARD_LIMIT = 1000;

/**
 * DatabaseExplorer — 数据库浏览/查询工具
 *
 * - 用 better-sqlite3 直连 sqlite 文件
 * - 提供 schema 内省 + 任意 SQL 执行（默认只读）
 * - 与业务 storage 包解耦：浏览器面板独立工具，不污染领域模型
 */
export class DatabaseExplorer {
  private readonly sources = new Map<string, SqliteSource>();
  private readonly log: ReturnType<LogService["child"]>;

  constructor(logger: LogService) {
    this.log = logger.child({ component: "DatabaseExplorer" });
  }

  /** 注册一个 SQLite 数据源。失败时会记录但不抛出，避免阻塞启动 */
  registerSqlite(name: string, file: string): void {
    const abs = resolve(file);
    try {
      // better-sqlite3 不会自动创建父目录；首次启动时 data/ 还不存在，先确保目录
      mkdirSync(dirname(abs), { recursive: true });
      const db = new Database(abs, { fileMustExist: false });
      db.pragma("journal_mode = WAL");
      this.sources.set(name, { name, kind: "sqlite", file: abs, db });
      this.log.info(`Registered sqlite source: ${name} -> ${abs}`);
    } catch (err) {
      this.log.error(`Failed to open sqlite ${abs}`, { err });
    }
  }

  listSources(): DataSourceMeta[] {
    return [...this.sources.values()].map((s) => ({
      name: s.name,
      kind: s.kind,
      location: s.file,
      ready: true,
    }));
  }

  listTables(name: string): TableInfo[] {
    const src = this._must(name);
    const tables = src.db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
      )
      .all() as { name: string }[];

    const out: TableInfo[] = [];
    for (const t of tables) {
      let rowCount = 0;
      try {
        const r = src.db
          .prepare(`SELECT COUNT(*) AS c FROM "${t.name.replace(/"/g, '""')}"`)
          .get() as { c: number };
        rowCount = Number(r.c) || 0;
      } catch {
        // 某些 virtual table 可能不支持 COUNT(*)，忽略
      }
      out.push({ name: t.name, rowCount });
    }
    return out;
  }

  getSchema(name: string, table: string): ColumnInfo[] {
    const src = this._must(name);
    // PRAGMA table_info(<table>) — 双引号转义
    const escaped = table.replace(/"/g, '""');
    const rows = src.db.pragma(`table_info("${escaped}")`) as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;
    return rows.map((c) => ({
      name: c.name,
      type: c.type,
      notNull: !!c.notnull,
      pk: c.pk > 0,
      defaultValue: c.dflt_value,
    }));
  }

  /**
   * 执行任意 SQL
   * - readOnly=true（默认）只允许 reader 语句（SELECT / EXPLAIN / WITH / PRAGMA 等）
   * - 返回数组化的 rows 与 columns，避免 JSON 中重复字段名
   * - 单次查询硬上限 HARD_LIMIT 行
   */
  query(
    name: string,
    sql: string,
    params: unknown[] | Record<string, unknown> = [],
    opts: { readOnly?: boolean } = {}
  ): QueryResult {
    const src = this._must(name);
    const readOnly = opts.readOnly ?? true;

    const stmt = src.db.prepare(sql);
    const t0 = performance.now();

    if (stmt.reader) {
      stmt.raw(true); // 数组形式返回，节省序列化开销
      const allRows = stmt.all(params as never) as unknown[][];
      const truncated = allRows.length > HARD_LIMIT;
      const rows = truncated ? allRows.slice(0, HARD_LIMIT) : allRows;
      const columns = stmt.columns().map((c) => ({ name: c.name }));
      return {
        columns,
        rows: this._serializableRows(rows),
        rowCount: rows.length,
        truncated,
        durationMs: +(performance.now() - t0).toFixed(2),
      };
    }

    if (readOnly) {
      throw new Error(
        "当前为只读模式，仅允许 SELECT / EXPLAIN / WITH / PRAGMA。如需写入请关闭只读模式。"
      );
    }
    const info = stmt.run(params as never);
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      rowsAffected: info.changes,
      lastInsertRowid:
        typeof info.lastInsertRowid === "bigint"
          ? info.lastInsertRowid.toString()
          : info.lastInsertRowid,
      durationMs: +(performance.now() - t0).toFixed(2),
    };
  }

  /** 关闭所有连接 */
  close(): void {
    for (const s of this.sources.values()) {
      try {
        s.db.close();
      } catch {
        /* noop */
      }
    }
    this.sources.clear();
  }

  private _must(name: string): SqliteSource {
    const s = this.sources.get(name);
    if (!s) throw new Error(`未知数据源: ${name}`);
    return s;
  }

  /** 把 BigInt / Buffer 等不可 JSON 化的值转为安全形式 */
  private _serializableRows(rows: unknown[][]): unknown[][] {
    return rows.map((row) =>
      row.map((cell) => {
        if (typeof cell === "bigint") return cell.toString();
        if (cell instanceof Uint8Array) {
          // 二进制：截断到 64 字节，避免传一大坨
          const bytes = cell.byteLength;
          const head = Buffer.from(
            cell.slice(0, Math.min(64, bytes))
          ).toString("hex");
          return `<Buffer ${bytes}B 0x${head}${bytes > 64 ? "…" : ""}>`;
        }
        return cell;
      })
    );
  }
}
