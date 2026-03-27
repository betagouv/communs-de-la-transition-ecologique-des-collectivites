import { Controller, Get, Query, UseGuards, NotFoundException, BadRequestException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { CustomLogger } from "@logging/logger.service";
import { DatabaseService } from "@database/database.service";
import { refCommunes } from "@database/schema";
import { eq } from "drizzle-orm";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { AidesTerritoiresService, AideTerritoires } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService, MatchResult } from "./aides-matching.service";
import { AidesCacheService } from "./aides-cache.service";
import { AidesWarmupService } from "./aides-warmup.service";

interface EnrichedAide extends AideTerritoires {
  classification?: {
    thematiques: { label: string; score: number }[];
    sites: { label: string; score: number }[];
    interventions: { label: string; score: number }[];
  };
  matchingScore?: number;
  labelsCommuns?: {
    thematiques: string[];
    sites: string[];
    interventions: string[];
  };
}

@ApiBearerAuth()
@ApiTags("Aides")
@Controller("aides")
@UseGuards(ApiKeyGuard)
export class AidesController {
  private readonly refreshingKeys = new Set<string>();

  constructor(
    private readonly atService: AidesTerritoiresService,
    private readonly classificationService: AideClassificationService,
    private readonly matchingService: AidesMatchingService,
    private readonly cacheService: AidesCacheService,
    private readonly warmupService: AidesWarmupService,
    private readonly dbService: DatabaseService,
    private readonly projetsService: GetProjetsService,
    private readonly logger: CustomLogger,
  ) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Lister les aides enrichies avec classification",
    description:
      "Proxy enrichi de l'API Aides-Territoires. Retourne les aides avec classification thématiques/sites/interventions. Si projet_id est fourni, filtre par territoires du projet (union des collectivités) et calcule un score de matching trié par pertinence.",
  })
  @ApiQuery({
    name: "projet_id",
    required: true,
    description: "ID projet pour filtrer par territoire et calculer le matching",
  })
  @ApiQuery({ name: "limit", required: false, description: "Nombre max de résultats (défaut: 20)" })
  async listAides(
    @Query("projet_id") projetId: string,
    @Query("limit") limit?: string,
  ): Promise<{ aides: EnrichedAide[]; total: number }> {
    if (!projetId) {
      throw new BadRequestException("projet_id is required");
    }

    const maxResults = parseInt(limit ?? "20", 10);

    // 1. Load project with its collectivités
    const projet = await this.projetsService.findOne(projetId);

    if (!projet.classificationScores) {
      throw new NotFoundException(`Project ${projetId} has no classification scores yet`);
    }

    // 2. Extract code_insee from project collectivités and resolve perimeter_ids
    const codesInsee = this.extractCodesInsee(projet.collectivites);

    if (codesInsee.length === 0) {
      this.logger.warn(
        `Project ${projetId} has no collectivités with code_insee, fetching aides without territory filter`,
      );
    }

    // 3. Fetch aides for each territory (union) — deduplicate by aide id
    const allAides = await this.fetchAidesForTerritories(codesInsee);

    // 4. Get classifications for these aides (from DB cache)
    const aideIds = allAides.map((a) => String(a.id));
    const classifications = await this.classificationService.getCachedClassifications(aideIds);

    // 5. Do matching
    const matchResults = new Map<string, MatchResult>();
    const results = this.matchingService.match(projet.classificationScores, classifications, maxResults);
    for (const r of results) {
      matchResults.set(r.idAt, r);
    }

    // 6. Enrich and sort by matching score
    let enriched: EnrichedAide[] = allAides.map((aide) => {
      const idAt = String(aide.id);
      const classification = classifications.get(idAt);
      const match = matchResults.get(idAt);

      return {
        ...aide,
        classification: classification ?? undefined,
        matchingScore: match?.score,
        labelsCommuns: match?.labelsCommuns,
      };
    });

    enriched = enriched
      .filter((a) => a.matchingScore !== undefined)
      .sort((a, b) => (b.matchingScore ?? 0) - (a.matchingScore ?? 0));

    enriched = enriched.slice(0, maxResults);

    return { aides: enriched, total: allAides.length };
  }

  @TrackApiUsage()
  @Get("sync")
  @ApiOperation({
    summary: "Synchroniser les classifications des aides",
    description:
      "Déclenche la classification LLM des aides non encore classifiées ou modifiées. Invalide le cache Redis.",
  })
  async syncClassifications(): Promise<{
    classified: number;
    cached: number;
    total: number;
    warmup: { territories: number; duration: number };
  }> {
    this.logger.log("Starting aide classification sync");
    const aides = await this.atService.fetchAides();
    const result = await this.classificationService.syncClassifications(aides);

    // Invalidate territory indexes after sync (classifications changed)
    await this.cacheService.invalidateTerritories();

    // Pre-warm cache for all active territories
    const warmup = await this.warmupService.warmup();

    return { ...result, total: aides.length, warmup };
  }

  /**
   * Extract unique code_insee values from project collectivités (Communes only)
   */
  private extractCodesInsee(collectivites: { type: string; codeInsee: string | null }[]): string[] {
    const codes: string[] = [];
    for (const c of collectivites) {
      if (c.type === "Commune" && c.codeInsee) {
        codes.push(c.codeInsee);
      }
    }
    return [...new Set(codes)];
  }

  /**
   * Resolve a code_insee to an AT perimeter_id (with cache)
   */
  private async resolvePerimeter(codeInsee: string): Promise<string | null> {
    let perimeterId = await this.cacheService.getPerimeterId(codeInsee);
    if (perimeterId) return perimeterId;

    const [commune] = await this.dbService.database
      .select({ nom: refCommunes.nom })
      .from(refCommunes)
      .where(eq(refCommunes.codeInsee, codeInsee))
      .limit(1);

    const communeName = commune?.nom;
    perimeterId = await this.atService.resolvePerimeterId(codeInsee, communeName ?? undefined);
    if (perimeterId) {
      await this.cacheService.setPerimeterId(codeInsee, perimeterId);
    } else {
      this.logger.warn(`Could not resolve code_insee ${codeInsee} to AT perimeter_id`);
    }
    return perimeterId;
  }

  /**
   * Fetch aides for a single territory with SWR.
   * Returns aides immediately (from cache if available), triggers background refresh if stale.
   */
  private async fetchAidesForTerritory(params: Record<string, string>, label: string): Promise<AideTerritoires[]> {
    const cacheKey = this.cacheService.buildKey(params);
    const cached = await this.cacheService.get(cacheKey);

    if (cached?.status === "fresh") {
      return cached.aides;
    }

    if (cached?.status === "stale") {
      // Serve stale data immediately, refresh in background
      this.refreshInBackground(cacheKey, params, label);
      return cached.aides;
    }

    // Cache miss — synchronous fetch (cold start)
    this.logger.log(`Cache miss for AT aides, fetching from API (${label})`);
    const aides = await this.atService.fetchAides(params);
    await this.cacheService.set(cacheKey, aides);
    return aides;
  }

  /**
   * Fire-and-forget background refresh for stale cache entries.
   */
  private refreshInBackground(cacheKey: string, params: Record<string, string>, label: string): void {
    if (this.refreshingKeys.has(cacheKey)) return;
    this.refreshingKeys.add(cacheKey);

    this.atService
      .fetchAides(params)
      .then((aides) => this.cacheService.set(cacheKey, aides))
      .then(() => this.logger.log(`Background refresh complete for ${label}`))
      .catch((error) =>
        this.logger.error(`Background refresh failed for ${label}`, {
          error: { message: error instanceof Error ? error.message : "Unknown error" },
        }),
      )
      .finally(() => this.refreshingKeys.delete(cacheKey));
  }

  /**
   * Fetch aides for multiple territories (union). Deduplicates by aide id.
   */
  private async fetchAidesForTerritories(codesInsee: string[]): Promise<AideTerritoires[]> {
    if (codesInsee.length === 0) {
      return this.fetchAidesForTerritory({}, "no territory filter");
    }

    const seenIds = new Set<number>();
    const allAides: AideTerritoires[] = [];

    for (const codeInsee of codesInsee) {
      const perimeterId = await this.resolvePerimeter(codeInsee);
      const params: Record<string, string> = {};
      if (perimeterId) {
        params.perimeter = perimeterId;
      }

      const aides = await this.fetchAidesForTerritory(params, `code_insee=${codeInsee}`);

      // Deduplicate across territories
      for (const aide of aides) {
        if (!seenIds.has(aide.id)) {
          seenIds.add(aide.id);
          allAides.push(aide);
        }
      }
    }

    this.logger.log(`Fetched ${allAides.length} unique aides across ${codesInsee.length} territories`);
    return allAides;
  }
}
