// 类型
export type { LogEntry, LogQueryParams, LogRepository, CacheRepository } from "./types.js";

// 适配器
export { SqliteLogRepository } from "./sqlite.js";
export { MysqlLogRepository } from "./mysql.js";
export { RedisRepository } from "./redis.js";

// Service
export { StorageService, storageService } from "./service.js";
export type { StorageOptions } from "./service.js";
