import { SqliteLogRepository } from "./sqlite.js";
import { MysqlLogRepository } from "./mysql.js";
import { RedisRepository } from "./redis.js";
import type { CacheRepository, LogRepository } from "./types.js";

// ---------------------------------------------------------------------------
// StorageService 配置
// ---------------------------------------------------------------------------

export interface StorageOptions {
  /** SQLite 数据库文件路径，不填则不启用 SQLite */
  sqlite?: string;
  /** MySQL 连接字符串，不填则不启用 MySQL */
  mysql?: string;
  /** Redis 连接字符串，不填则不启用 Redis */
  redis?: string;
}

// ---------------------------------------------------------------------------
// StorageService
// ---------------------------------------------------------------------------

export class StorageService {
  private _log: LogRepository | null = null;
  private _cache: CacheRepository | null = null;

  /**
   * 根据配置初始化适配器。
   * 优先级：MySQL > SQLite（两者都配置时 MySQL 优先作为日志库）。
   */
  async init(options: StorageOptions): Promise<void> {
    if (options.mysql) {
      const repo = new MysqlLogRepository(options.mysql);
      await repo.init();
      this._log = repo;
    } else if (options.sqlite) {
      this._log = new SqliteLogRepository(options.sqlite);
    }

    if (options.redis) {
      const repo = new RedisRepository(options.redis);
      await repo.connect();
      this._cache = repo;
    }
  }

  /**
   * 获取日志仓库。未配置时抛出错误。
   */
  get log(): LogRepository {
    if (!this._log) {
      throw new Error(
        "[storage] 未配置日志存储，请在 settings.yaml 中设置 storage.sqlite 或 storage.mysql",
      );
    }
    return this._log;
  }

  /**
   * 获取缓存仓库（Redis）。未配置时抛出错误。
   */
  get cache(): CacheRepository {
    if (!this._cache) {
      throw new Error(
        "[storage] 未配置 Redis，请在 settings.yaml 中设置 storage.redis",
      );
    }
    return this._cache;
  }

  /** 是否已配置日志存储 */
  get hasLog(): boolean {
    return this._log !== null;
  }

  /** 是否已配置 Redis 缓存 */
  get hasCache(): boolean {
    return this._cache !== null;
  }

  /**
   * 关闭所有连接，释放资源。
   */
  async close(): Promise<void> {
    await this._log?.close();
    await this._cache?.close();
    this._log = null;
    this._cache = null;
  }
}

/** 全局单例 */
export const storageService = new StorageService();
