import { Redis } from "ioredis";
import type { CacheRepository } from "./types.js";

// ---------------------------------------------------------------------------
// Redis 缓存仓库
// ---------------------------------------------------------------------------

export class RedisRepository implements CacheRepository {
  private readonly client: Redis;

  constructor(connectionString: string) {
    this.client = new Redis(connectionString, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    this.client.disconnect();
  }
}
