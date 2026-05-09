// ---------------------------------------------------------------------------
// 通用存储接口
// ---------------------------------------------------------------------------

/** 日志条目结构 */
export interface LogEntry {
  id?: number;
  botId: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  meta?: Record<string, unknown>;
  createdAt?: Date;
}

/** 日志查询参数 */
export interface LogQueryParams {
  botId?: string;
  level?: LogEntry["level"];
  /** 最多返回条数，默认 100 */
  limit?: number;
  /** 偏移量，默认 0 */
  offset?: number;
  /** 起始时间 */
  from?: Date;
  /** 结束时间 */
  to?: Date;
}

/** 日志仓库接口（所有适配器必须实现） */
export interface LogRepository {
  /** 写入一条日志 */
  write(entry: LogEntry): Promise<void>;
  /** 查询日志 */
  query(params: LogQueryParams): Promise<LogEntry[]>;
  /**
   * 清理过期日志
   * @param retentionDays 保留天数，超过的日志将被删除
   */
  cleanup(retentionDays: number): Promise<void>;
  /** 关闭连接/释放资源 */
  close(): Promise<void>;
}

/** KV 缓存接口（Redis 适配器实现） */
export interface CacheRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  close(): Promise<void>;
}
