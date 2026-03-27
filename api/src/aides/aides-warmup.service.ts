import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { DatabaseService } from "@database/database.service";
import { collectivites, projetsToCollectivites } from "@database/schema";
import { eq, sql } from "drizzle-orm";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AidesCacheService } from "./aides-cache.service";

/** Delay between each territory fetch to avoid AT rate-limiting (429) */
const DELAY_BETWEEN_TERRITORIES_MS = 3000;

/** Max retries on 429 responses */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff on 429 */
const RETRY_BASE_DELAY_MS = 10000;

/**
 * Pre-warms the aides cache for all territories linked to existing projects.
 * Designed to run after the daily classification sync (cron 3h UTC).
 *
 * Territories are processed sequentially with a delay between each to respect
 * the Aides-Territoires API rate limits.
 */
@Injectable()
export class AidesWarmupService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly atService: AidesTerritoiresService,
    private readonly cacheService: AidesCacheService,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * Find all distinct commune codes INSEE that are linked to at least one project.
   */
  async getActiveCodesInsee(): Promise<{ codeInsee: string; nom: string }[]> {
    const rows = await this.dbService.database
      .selectDistinct({
        codeInsee: collectivites.codeInsee,
        nom: collectivites.nom,
      })
      .from(collectivites)
      .innerJoin(projetsToCollectivites, eq(projetsToCollectivites.collectiviteId, collectivites.id))
      .where(sql`${collectivites.type} = 'Commune' AND ${collectivites.codeInsee} IS NOT NULL`);

    return rows.filter((r): r is { codeInsee: string; nom: string } => r.codeInsee !== null);
  }

  /**
   * Pre-warm the cache for all active territories.
   * Processes territories sequentially with a delay to avoid AT API rate-limiting.
   */
  async warmup(): Promise<{ territories: number; failed: number; duration: number }> {
    const start = Date.now();
    const communes = await this.getActiveCodesInsee();
    this.logger.log(`Cache warmup: ${communes.length} active territories to pre-warm`);

    if (communes.length === 0) {
      return { territories: 0, failed: 0, duration: 0 };
    }

    let warmed = 0;
    let failed = 0;

    for (let i = 0; i < communes.length; i++) {
      const commune = communes[i];

      try {
        await this.warmTerritoryWithRetry(commune.codeInsee, commune.nom);
        warmed++;
      } catch (error) {
        failed++;
        this.logger.error(`Cache warmup failed for ${commune.nom} (${commune.codeInsee})`, {
          error: { message: error instanceof Error ? error.message : "Unknown error" },
        });
      }

      // Progress log every 50 territories
      if ((i + 1) % 50 === 0) {
        this.logger.log(`Cache warmup progress: ${i + 1}/${communes.length} (${warmed} ok, ${failed} failed)`);
      }

      // Delay before next territory to respect AT rate limits
      if (i < communes.length - 1) {
        await this.delay(DELAY_BETWEEN_TERRITORIES_MS);
      }
    }

    const duration = Date.now() - start;
    this.logger.log(
      `Cache warmup complete: ${warmed}/${communes.length} territories in ${Math.round(duration / 1000)}s (${failed} failed)`,
    );
    return { territories: warmed, failed, duration };
  }

  /**
   * Pre-warm cache for a single territory, with retry on 429.
   */
  private async warmTerritoryWithRetry(codeInsee: string, communeName: string): Promise<void> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.warmTerritory(codeInsee, communeName);
        return;
      } catch (error) {
        const is429 = error instanceof Error && error.message.includes("429");
        if (!is429 || attempt === MAX_RETRIES) {
          throw error;
        }

        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        this.logger.warn(`AT rate-limited for ${communeName} (${codeInsee}), retrying in ${backoff / 1000}s...`);
        await this.delay(backoff);
      }
    }
  }

  /**
   * Pre-warm cache for a single territory.
   */
  private async warmTerritory(codeInsee: string, communeName: string): Promise<void> {
    // 1. Resolve perimeter ID (from cache or AT API)
    let perimeterId = await this.cacheService.getPerimeterId(codeInsee);
    if (!perimeterId) {
      perimeterId = await this.atService.resolvePerimeterId(codeInsee, communeName);
      if (perimeterId) {
        await this.cacheService.setPerimeterId(codeInsee, perimeterId);
      }
    }

    // 2. Fetch aides from AT and store in cache
    const params: Record<string, string> = {};
    if (perimeterId) {
      params.perimeter = perimeterId;
    }

    const cacheKey = this.cacheService.buildKey(params);
    const aides = await this.atService.fetchAides(params);
    await this.cacheService.set(cacheKey, aides);

    this.logger.log(`Warmed territory ${communeName} (${codeInsee}): ${aides.length} aides`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
