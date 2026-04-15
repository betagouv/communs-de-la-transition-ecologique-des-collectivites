import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import Redis from "ioredis";
import { AideTerritoires } from "./aides-territoires.service";

const AIDE_PREFIX = "at:aide:";
const TERRITORY_PREFIX = "at:territory:";
const AIDE_TTL_SECONDS = 86400 * 7; // 7 days — aides catalog, long-lived
const FRESH_TTL_SECONDS = 3600; // 1 hour — territory index considered fresh
const STALE_MAX_TTL_SECONDS = 86400 * 7; // 7 days — max staleness before eviction

/**
 * Stored alongside the territory index to track SWR freshness.
 * `storedAt` is the epoch (ms) when the entry was last refreshed.
 */
interface TerritoryEntry {
  ids: number[];
  storedAt: number;
}

export type CacheStatus = "fresh" | "stale" | "miss";

export interface CacheResult {
  aides: AideTerritoires[];
  status: CacheStatus;
}

/**
 * Redis cache for Aides-Territoires API responses.
 *
 * Two-level deduplicated cache:
 *   Level 1 – `at:aide:{id}`        → individual aide JSON (TTL 7d)
 *   Level 2 – `at:territory:{key}`  → list of aide IDs + timestamp (TTL 7d)
 *
 * SWR (stale-while-revalidate):
 *   - fresh  (< 1h since storedAt) → serve directly
 *   - stale  (1h–7d)               → serve immediately, caller triggers background refresh
 *   - miss   (no entry / expired)  → caller must fetch synchronously (cold start)
 */
@Injectable()
export class AidesCacheService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {
    const redisUrl = this.configService.getOrThrow<string>("REDIS_URL");
    this.redis = new Redis(redisUrl);
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Territory-level read (SWR)
  // ---------------------------------------------------------------------------

  /**
   * Get cached aides for a territory query key.
   * Returns aides + freshness status so the caller can trigger a background refresh when stale.
   */
  async get(queryKey: string): Promise<CacheResult | null> {
    const raw = await this.redis.get(`${TERRITORY_PREFIX}${queryKey}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as TerritoryEntry;
    const status = this.resolveStatus(entry.storedAt);

    this.logger.log(`Cache ${status} for territory: ${queryKey} (${entry.ids.length} aide IDs)`);

    // Fetch individual aides via MGET
    const aides = await this.getAidesByIds(entry.ids);
    return { aides, status };
  }

  // ---------------------------------------------------------------------------
  // Territory-level write
  // ---------------------------------------------------------------------------

  /**
   * Store aides for a territory. Writes individual aides then the territory index.
   * Aides are written first so the index never points to missing keys.
   */
  async set(queryKey: string, aides: AideTerritoires[]): Promise<void> {
    if (aides.length === 0) return;

    // 1. Bulk upsert individual aides
    await this.setAides(aides);

    // 2. Write territory index with timestamp
    const entry: TerritoryEntry = {
      ids: aides.map((a) => a.id),
      storedAt: Date.now(),
    };
    await this.redis.set(`${TERRITORY_PREFIX}${queryKey}`, JSON.stringify(entry), "EX", STALE_MAX_TTL_SECONDS);

    this.logger.log(`Cached ${aides.length} aides for territory: ${queryKey}`);
  }

  // ---------------------------------------------------------------------------
  // Individual aide operations
  // ---------------------------------------------------------------------------

  /**
   * Bulk store individual aides in Redis via pipeline.
   */
  private async setAides(aides: AideTerritoires[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const aide of aides) {
      pipeline.set(`${AIDE_PREFIX}${aide.id}`, JSON.stringify(aide), "EX", AIDE_TTL_SECONDS);
    }
    await pipeline.exec();
  }

  /**
   * Retrieve aides by ID list using MGET. Silently skips expired/missing keys.
   */
  private async getAidesByIds(ids: number[]): Promise<AideTerritoires[]> {
    if (ids.length === 0) return [];

    const keys = ids.map((id) => `${AIDE_PREFIX}${id}`);
    const values = await this.redis.mget(...keys);

    const aides: AideTerritoires[] = [];
    for (const v of values) {
      if (v) {
        aides.push(JSON.parse(v) as AideTerritoires);
      }
    }
    return aides;
  }

  // ---------------------------------------------------------------------------
  // Cache key building
  // ---------------------------------------------------------------------------

  buildKey(params: Record<string, string>): string {
    const sorted = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return sorted || "all";
  }

  // ---------------------------------------------------------------------------
  // Invalidation
  // ---------------------------------------------------------------------------

  /**
   * Invalidate all territory indexes. Individual aide entries are left to expire
   * naturally (7d TTL) — they will be overwritten on next refresh anyway.
   */
  async invalidateTerritories(): Promise<void> {
    let deleted = 0;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", `${TERRITORY_PREFIX}*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");

    if (deleted > 0) {
      this.logger.log(`Invalidated ${deleted} territory cache entries`);
    }
  }

  /**
   * @deprecated Use invalidateTerritories() instead. Kept for backward compat during migration.
   */
  async invalidateAll(): Promise<void> {
    await this.invalidateTerritories();
  }

  // ---------------------------------------------------------------------------
  // SWR helpers
  // ---------------------------------------------------------------------------

  private resolveStatus(storedAt: number): CacheStatus {
    const ageSeconds = (Date.now() - storedAt) / 1000;
    if (ageSeconds < FRESH_TTL_SECONDS) return "fresh";
    return "stale";
  }
}
