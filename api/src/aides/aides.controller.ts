import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { CustomLogger } from "@logging/logger.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import {
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
  PROJECT_QUALIFICATION_QUEUE_NAME,
} from "@/projet-qualification/const";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesCacheService } from "./aides-cache.service";
import { AidesWarmupService } from "./aides-warmup.service";
import { AidesFeedbackService } from "./aides-feedback.service";
import { CreateAideFeedbackRequest, DeleteAideFeedbackRequest } from "./dto/aide-feedback.dto";
import {
  Aide,
  AideMatchResult,
  AidesListResponse,
  AidesSyncResponse,
  AideWithClassification,
  ClassificationPendingResponse,
} from "./dto/aides.dto";

const CLASSIFICATION_RETRY_AFTER_SECONDS = 15;

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
    private readonly feedbackService: AidesFeedbackService,
    private readonly projetsService: GetProjetsService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private readonly qualificationQueue: Queue,
    private readonly logger: CustomLogger,
  ) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Lister les aides enrichies avec classification",
    description:
      "Proxy enrichi de l'API Aides-Territoires. Retourne les aides avec classification thématiques/sites/interventions, filtrées par les territoires du projet (union des collectivités) et triées par score de matching.\n\n**Statuts de réponse** :\n- `200 ok` : aides matchées trouvées\n- `200 no_match` : aides présentes sur le périmètre mais aucune ne partage de label ≥ 0.8\n- `200 no_aides_on_perimeter` : aucune aide AT trouvée pour les codes INSEE du projet\n- `202 classification_pending` : projet pas encore classifié, job de classification (re)déclenché — réessayer après `retryAfter` secondes\n- `404` : projet inexistant",
  })
  @ApiQuery({
    name: "projet_id",
    required: true,
    description: "ID projet pour filtrer par territoire et calculer le matching",
  })
  @ApiQuery({ name: "limit", required: false, description: "Nombre max de résultats (défaut: 20)" })
  @ApiEndpointResponses({
    successStatus: 200,
    response: AidesListResponse,
    description: "Aides enrichies avec score de matching (status: ok | no_match | no_aides_on_perimeter)",
  })
  @ApiResponse({
    status: 202,
    type: ClassificationPendingResponse,
    description:
      "Le projet n'a pas encore été classifié. Un job de classification a été (re)déclenché. Réessayer après `retryAfter` secondes.",
  })
  async listAides(
    @Query("projet_id") projetId: string,
    @Res({ passthrough: true }) res: Response,
    @Query("limit") limit?: string,
  ): Promise<AidesListResponse | ClassificationPendingResponse> {
    if (!projetId) {
      throw new BadRequestException("projet_id is required");
    }

    const maxResults = parseInt(limit ?? "20", 10);

    // 1. Load project (throws 404 if not found)
    const projet = await this.projetsService.findOne(projetId);

    // 2. If not classified yet → enqueue classification + return 202
    if (!projet.classificationScores) {
      const triggered = await this.triggerClassificationIfNeeded(projetId);
      res.status(202).setHeader("Retry-After", String(CLASSIFICATION_RETRY_AFTER_SECONDS));
      return {
        status: "classification_pending",
        projetId,
        retryAfter: CLASSIFICATION_RETRY_AFTER_SECONDS,
        classificationTriggered: triggered,
      };
    }

    // 3. Extract code_insee from project collectivités
    const codesInsee = this.extractCodesInsee(projet.collectivites);

    if (codesInsee.length === 0) {
      this.logger.warn(
        `Project ${projetId} has no collectivités with code_insee, fetching aides without territory filter`,
      );
    }

    // 4. Fetch aides for each territory (union) — deduplicate by aide id
    const allAides = await this.fetchAidesForTerritories(codesInsee);

    if (allAides.length === 0) {
      return { status: "no_aides_on_perimeter", aides: [], total: 0 };
    }

    // 5. Get classifications for these aides (from DB cache)
    const aideIds = allAides.map((a) => String(a.id));
    const classifications = await this.classificationService.getCachedClassifications(aideIds);

    // 6. Do matching
    const matchResults = new Map<string, AideMatchResult>();
    const results = this.matchingService.match(projet.classificationScores, classifications, maxResults);
    for (const r of results) {
      matchResults.set(r.idAt, r);
    }

    // 7. Enrich and sort by matching score
    let enriched: AideWithClassification[] = allAides.map((aide) => {
      const idAt = String(aide.id);
      const classification = classifications.get(idAt);
      const match = matchResults.get(idAt);

      return {
        ...aide,
        classification: classification ?? undefined,
        matchingScore: match?.score,
        normalizedScore: match?.normalizedScore,
        axesMatched: match?.axesMatched,
        labelsCommuns: match?.labelsCommuns,
      };
    });

    enriched = enriched
      .filter((a) => a.matchingScore !== undefined)
      .sort((a, b) => (b.matchingScore ?? 0) - (a.matchingScore ?? 0))
      .slice(0, maxResults);

    if (enriched.length === 0) {
      return { status: "no_match", aides: [], total: allAides.length };
    }

    return { status: "ok", aides: enriched, total: allAides.length };
  }

  /**
   * Enqueue a classification job for the project if none is already pending or active.
   * Uses a deterministic jobId so concurrent polls from MEC don't pile up duplicate jobs.
   * Returns true if a new job was enqueued, false if one was already in flight.
   */
  private async triggerClassificationIfNeeded(projetId: string): Promise<boolean> {
    const jobId = `auto-classify:${projetId}`;
    const existing = await this.qualificationQueue.getJob(jobId);

    if (existing) {
      const state = await existing.getState();
      if (state === "waiting" || state === "active" || state === "delayed") {
        this.logger.log(`Classification already in flight for ${projetId} (state=${state}), not re-enqueuing`);
        return false;
      }
      // Stale completed/failed job blocks re-add with same id — remove it first
      await existing.remove();
    }

    await this.qualificationQueue.add(
      PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
      { projetId },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
    this.logger.log(`Enqueued classification job for ${projetId} (triggered by GET /aides)`);
    return true;
  }

  @TrackApiUsage()
  @Get("sync")
  @ApiOperation({
    summary: "Synchroniser les classifications des aides",
    description:
      "Déclenche la classification LLM des aides non encore classifiées ou modifiées. Invalide le cache Redis.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: AidesSyncResponse,
    description: "Résultat de la synchronisation",
  })
  async syncClassifications(): Promise<AidesSyncResponse> {
    this.logger.log("Starting aide classification sync");
    const aides = await this.atService.fetchAides();
    const result = await this.classificationService.syncClassifications(aides);

    // Invalidate territory indexes after sync (classifications changed)
    await this.cacheService.invalidateTerritories();

    // Pre-warm cache in background (fire-and-forget, too slow for HTTP response)
    this.warmupService.warmup().catch((error) =>
      this.logger.error("Background warmup failed after sync", {
        error: { message: error instanceof Error ? error.message : "Unknown error" },
      }),
    );

    return { ...result, total: aides.length, warmupStarted: true };
  }

  @TrackApiUsage()
  @Post("feedback")
  @ApiOperation({ summary: "Signaler une aide non pertinente pour un projet" })
  async createFeedback(@Body() dto: CreateAideFeedbackRequest) {
    return this.feedbackService.create(dto);
  }

  @TrackApiUsage()
  @Get("feedback")
  @ApiOperation({ summary: "Liste des feedbacks pour un projet" })
  @ApiQuery({
    name: "projetId",
    required: true,
    description: "ID du projet (UUID, communId)",
    example: "019df7ce-1234-7890-abcd-ef0123456789",
  })
  async getFeedbacks(@Query("projetId", new ParseUUIDPipe()) projetId: string) {
    return this.feedbackService.findByProjet(projetId);
  }

  @TrackApiUsage()
  @Delete("feedback")
  @ApiOperation({ summary: "Annuler un feedback" })
  @HttpCode(204)
  async deleteFeedback(@Body() dto: DeleteAideFeedbackRequest) {
    return this.feedbackService.delete(dto.projetId, dto.idAt);
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
   * Fetch aides for a single territory with SWR.
   * Returns aides immediately (from cache if available), triggers background refresh if stale.
   */
  private async fetchAidesForTerritory(params: Record<string, string>, label: string): Promise<Aide[]> {
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
   * Uses AT's perimeter_codes[] parameter which accepts code INSEE directly.
   */
  private async fetchAidesForTerritories(codesInsee: string[]): Promise<Aide[]> {
    if (codesInsee.length === 0) {
      return this.fetchAidesForTerritory({}, "no territory filter");
    }

    const seenIds = new Set<number>();
    const allAides: Aide[] = [];

    for (const codeInsee of codesInsee) {
      const params = { "perimeter_codes[]": codeInsee };
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
