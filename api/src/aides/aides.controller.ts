import { Controller, Get, Query, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { CustomLogger } from "@logging/logger.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { AidesTerritoiresService, AideTerritoires } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService, MatchResult } from "./aides-matching.service";

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
  @ApiQuery({ name: "perimeter", required: false, description: "ID de périmètre AT pour filtrer par territoire" })
  @ApiQuery({ name: "projet_id", required: false, description: "ID projet pour calculer le matching" })
  @ApiQuery({ name: "limit", required: false, description: "Nombre max de résultats (défaut: 20)" })
  async listAides(
    @Query("perimeter") perimeter?: string,
    @Query("projet_id") projetId?: string,
    @Query("limit") limit?: string,
  ): Promise<{ aides: EnrichedAide[]; total: number }> {
    const maxResults = parseInt(limit ?? "20", 10);

    // 1. Fetch aides from AT API
    const params: Record<string, string> = {};
    if (perimeter) params.perimeter = perimeter;

    this.logger.log(`Fetching aides from AT${perimeter ? ` (perimeter=${perimeter})` : ""}`);
    const aides = await this.atService.fetchAides(params);

    // 2. Get classifications for these aides (from cache)
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
    description: "Déclenche la classification LLM des aides non encore classifiées ou modifiées.",
  })
  async syncClassifications(): Promise<{ classified: number; cached: number; total: number }> {
    this.logger.log("Starting aide classification sync");
    const aides = await this.atService.fetchAides();
    const result = await this.classificationService.syncClassifications(aides);
    return { ...result, total: aides.length };
  }
}
