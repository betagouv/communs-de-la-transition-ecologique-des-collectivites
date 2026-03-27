import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import { DatabaseService } from "@database/database.service";
import { collectivites, projetsToCollectivites } from "@database/schema";
import { eq, sql } from "drizzle-orm";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AidesCacheService } from "./aides-cache.service";

const WARMUP_CONCURRENCY = 5;

/**
 * Pre-warms the aides cache for all territories linked to existing projects.
 * Designed to run after the daily classification sync (cron 3h UTC).
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
   * Resolves perimeter IDs and fetches aides from AT, storing them in the deduplicated cache.
   */
  async warmup(): Promise<{ territories: number; duration: number }> {
    const start = Date.now();
    const communes = await this.getActiveCodesInsee();
    this.logger.log(`Cache warmup: ${communes.length} active territories to pre-warm`);

    if (communes.length === 0) {
      return { territories: 0, duration: 0 };
    }

    let warmed = 0;

    // Process in batches to limit concurrency
    for (let i = 0; i < communes.length; i += WARMUP_CONCURRENCY) {
      const batch = communes.slice(i, i + WARMUP_CONCURRENCY);
      const results = await Promise.allSettled(batch.map((c) => this.warmTerritory(c.codeInsee, c.nom)));

      for (const result of results) {
        if (result.status === "fulfilled") {
          warmed++;
        } else {
          this.logger.error("Cache warmup failed for territory", {
            error: { message: result.reason instanceof Error ? result.reason.message : "Unknown error" },
          });
        }
      }
    }

    const duration = Date.now() - start;
    this.logger.log(`Cache warmup complete: ${warmed}/${communes.length} territories in ${duration}ms`);
    return { territories: warmed, duration };
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
}
