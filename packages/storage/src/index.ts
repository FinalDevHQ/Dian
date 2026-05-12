// 类型
export type {
  LogEntry, LogQueryParams, LogRepository, CacheRepository,
  MessageEntry, MessageRepository, MessageQueryParams, MessagePage,
  StatsFilter, OverviewStats,
  GroupStat, UserStat, TrendPoint, GroupNameEntry,
} from "./types.js";

// 适配器
export { SqliteLogRepository } from "./sqlite.js";
export { SqliteMessageRepository } from "./sqlite-messages.js";
export { MysqlLogRepository } from "./mysql.js";
export { RedisRepository } from "./redis.js";

// Service
export { StorageService, storageService } from "./service.js";
export type { StorageOptions } from "./service.js";
