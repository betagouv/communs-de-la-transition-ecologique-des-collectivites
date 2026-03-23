import { Controller, Get, Query, UseGuards, NotFoundException } from "@nestjs/common";
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
  constructor(
    private readonly atService: AidesTerritoiresService,
    private readonly classificationService: AideClassificationService,
    private readonly matchingService: AidesMatchingService,
    private readonly cacheService: AidesCacheService,
    private readonly dbService: DatabaseService,
    private readonly projetsService: GetProjetsService,
    private readonly logger: CustomLogger,
  ) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Lister les aides enrichies avec classification",
    description:
      "Proxy enrichi de l'API Aides-Territoires. Retourne les aides avec classification thématiques/sites/interventions. Si projet_id est fourni, calcule un score de matching et trie par pertinence.",
  })
  @ApiQuery({
    name: "code_insee",
    required: false,
    description: "Code INSEE commune ou code EPCI pour filtrer par territoire",
  })
  @ApiQuery({ name: "projet_id", required: false, description: "ID projet pour calculer le matching" })
  @ApiQuery({ name: "limit", required: false, description: "Nombre max de résultats (défaut: 20)" })
  async listAides(
    @Query("code_insee") codeInsee?: string,
    @Query("projet_id") projetId?: string,
    @Query("limit") limit?: string,
  ): Promise<{ aides: EnrichedAide[]; total: number }> {
    const maxResults = parseInt(limit ?? "20", 10);

    // 1. Resolve code_insee → AT perimeter_id (with cache)
    const params: Record<string, string> = {};
    if (codeInsee) {
      let perimeterId = await this.cacheService.getPerimeterId(codeInsee);
      if (!perimeterId) {
        // Lookup commune name from our referential DB
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
      }
      if (perimeterId) {
        params.perimeter = perimeterId;
      }
    }

    // 2. Fetch aides from AT API (with Redis cache)
    const cacheKey = this.cacheService.buildKey(params);
    let aides = await this.cacheService.get(cacheKey);

    if (!aides) {
      this.logger.log(`Cache miss for AT aides, fetching from API${codeInsee ? ` (code_insee=${codeInsee})` : ""}`);
      aides = await this.atService.fetchAides(params);
      await this.cacheService.set(cacheKey, aides);
    }

    // 2. Get classifications for these aides (from DB cache)
    const aideIds = aides.map((a) => String(a.id));
    const classifications = await this.classificationService.getCachedClassifications(aideIds);

    // 3. If projet_id, do matching
    let matchResults: Map<string, MatchResult> | null = null;

    if (projetId) {
      const projet = await this.projetsService.findOne(projetId);
      if (!projet.classificationScores) {
        throw new NotFoundException(`Project ${projetId} has no classification scores yet`);
      }

      matchResults = new Map<string, MatchResult>();
      const results = this.matchingService.match(projet.classificationScores, classifications, maxResults);
      for (const r of results) {
        matchResults.set(r.idAt, r);
      }
    }

    // 4. Enrich and sort
    let enriched: EnrichedAide[] = aides.map((aide) => {
      const idAt = String(aide.id);
      const classification = classifications.get(idAt);
      const match = matchResults?.get(idAt);

      return {
        ...aide,
        classification: classification ?? undefined,
        matchingScore: match?.score,
        labelsCommuns: match?.labelsCommuns,
      };
    });

    // If matching, sort by score and limit; otherwise just limit
    if (matchResults) {
      enriched = enriched
        .filter((a) => a.matchingScore !== undefined)
        .sort((a, b) => (b.matchingScore ?? 0) - (a.matchingScore ?? 0));
    }

    enriched = enriched.slice(0, maxResults);

    return { aides: enriched, total: aides.length };
  }

  @TrackApiUsage()
  @Get("sync")
  @ApiOperation({
    summary: "Synchroniser les classifications des aides",
    description:
      "Déclenche la classification LLM des aides non encore classifiées ou modifiées. Invalide le cache Redis.",
  })
  async syncClassifications(): Promise<{ classified: number; cached: number; total: number }> {
    this.logger.log("Starting aide classification sync");
    const aides = await this.atService.fetchAides();
    const result = await this.classificationService.syncClassifications(aides);

    // Invalidate AT cache after sync (classifications changed)
    await this.cacheService.invalidateAll();

    return { ...result, total: aides.length };
  }
}
