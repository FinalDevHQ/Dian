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

// ---------------------------------------------------------------------------
// 消息统计存储接口
// ---------------------------------------------------------------------------

/** 消息条目（仅 message 类型事件） */
export interface MessageEntry {
  id?: number;
  eventId: string;
  botId: string;
  /** group | private */
  subtype: string;
  groupId?: string;
  userId?: string;
  senderName?: string;
  messageId?: string;
  text?: string;
  /** Unix 秒级时间戳 */
  timestamp: number;
}

/** 群组统计行 */
export interface GroupStat {
  groupId: string;
  count: number;
  lastAt: number;
}

/** 用户统计行 */
export interface UserStat {
  userId: string;
  senderName?: string;
  count: number;
  lastAt: number;
}

/** 时间趋势点 */
export interface TrendPoint {
  date: string;  // YYYY-MM-DD
  count: number;
}

/** 群名缓存条目 */
export interface GroupNameEntry {
  groupId: string;
  name: string;
  /** Unix 秒 */
  updatedAt: number;
}

/** 消息查询参数 */
export interface MessageQueryParams {
  botId?: string;
  groupId?: string;
  userId?: string;
  /** 关键词全文搜索 */
  keyword?: string;
  /** subtype: group | private */
  subtype?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

/** 消息查询结果页 */
export interface MessagePage {
  total: number;
  items: MessageEntry[];
}

/** 消息统计仓库接口 */
export interface MessageRepository {
  /** 写入一条消息（eventId 重复时忽略） */
  writeMessage(entry: MessageEntry): Promise<void>;
  /** 分页查询消息记录 */
  queryMessages(params: MessageQueryParams): Promise<MessagePage>;
  /** 总览统计 */
  overviewStats(filter: StatsFilter): Promise<OverviewStats>;
  /** 按群组统计（Top N） */
  groupStats(filter: StatsFilter & { limit?: number }): Promise<GroupStat[]>;
  /** 按用户统计（Top N） */
  userStats(filter: StatsFilter & { limit?: number; groupId?: string }): Promise<UserStat[]>;
  /** 按天趋势 */
  trendStats(filter: StatsFilter): Promise<TrendPoint[]>;
  /** 查询已缓存的群名（传空数组时返回全部） */
  getGroupNames(groupIds?: string[]): Promise<GroupNameEntry[]>;
  /** 批量写入群名缓存（upsert） */
  upsertGroupNames(entries: { groupId: string; name: string }[]): Promise<void>;
  close(): Promise<void>;
}

export interface StatsFilter {
  botId?: string;
  groupId?: string;
  /** Unix 秒 */
  from?: number;
  /** Unix 秒 */
  to?: number;
}

export interface OverviewStats {
  total: number;
  groups: number;
  users: number;
  byBot: { botId: string; count: number }[];
}

/** KV 缓存接口（Redis 适配器实现） */
export interface CacheRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  close(): Promise<void>;
}
