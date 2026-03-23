import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import Redis from "ioredis";
import { AideTerritoires } from "./aides-territoires.service";

const CACHE_PREFIX = "at:aides:";
const DEFAULT_TTL_SECONDS = 3600; // 1 hour

/**
 * Redis cache for Aides-Territoires API responses
 * Caches aide lists by query key to avoid hitting AT API on every request
 */
@Injectable()
export class AidesCacheService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly ttl: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    const redisUrl = this.configService.getOrThrow<string>("REDIS_URL");
    this.redis = new Redis(redisUrl);
    this.ttl = DEFAULT_TTL_SECONDS;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * Get cached aides for a query key
   */
  async get(queryKey: string): Promise<AideTerritoires[] | null> {
    const cached = await this.redis.get(`${CACHE_PREFIX}${queryKey}`);
    if (!cached) return null;

    this.logger.log(`Cache hit for AT aides: ${queryKey}`);
    return JSON.parse(cached) as AideTerritoires[];
  }

  /**
   * Cache aides for a query key
   */
  async set(queryKey: string, aides: AideTerritoires[]): Promise<void> {
    await this.redis.set(`${CACHE_PREFIX}${queryKey}`, JSON.stringify(aides), "EX", this.ttl);
    this.logger.log(`Cached ${aides.length} aides for key: ${queryKey} (TTL: ${this.ttl}s)`);
  }

  /**
   * Build a cache key from query parameters
   */
  buildKey(params: Record<string, string>): string {
    const sorted = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return sorted || "all";
  }

  /**
   * Invalidate all AT aide caches
   */
  async invalidateAll(): Promise<void> {
    const keys = await this.redis.keys(`${CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.log(`Invalidated ${keys.length} AT aide cache entries`);
    }
  }
}
