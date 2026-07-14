import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { CustomLogger } from "@logging/logger.service";
import { GetProjetsService, ProjetSource } from "@projets/services/get-projets/get-projets.service";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import {
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
  PROJECT_QUALIFICATION_QUEUE_NAME,
} from "@/projet-qualification/const";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesTextualMatchingService } from "./aides-textual-matching.service";
import { AidesCacheService } from "./aides-cache.service";
import { AidesPerimetreService } from "./aides-perimetre.service";
import { AjoutsManuelsService } from "@/ajouts-manuels/ajouts-manuels.service";
import { AjoutManuelResponse } from "@/ajouts-manuels/dto/ajout-manuel.dto";
import { AidesWarmupService } from "./aides-warmup.service";
import { AidesFeedbackService } from "./aides-feedback.service";
import { AideFeedbackResponse, CreateAideFeedbackRequest, DeleteAideFeedbackRequest } from "./dto/aide-feedback.dto";
import {
  Aide,
  AideClassification,
  AideMatchResult,
  AidesListResponse,
  AidesSearchRequest,
  AidesSyncResponse,
  AideWithClassification,
  ClassificationPendingResponse,
} from "./dto/aides.dto";
import { MatchThresholds } from "./aides-matching.service";

const CLASSIFICATION_RETRY_AFTER_SECONDS = 15;

// Matching textuel — pondération de la combinaison thématique / textuel et
// plancher de "rescue" pour qu'une aide non matchée thématiquement remonte.
// Le thématique (labels de classification) est plus fiable que le lexical :
// il domine nettement le score combiné, le textuel reste un bonus + rescue.
const W_THEMATIC = 0.85;
const W_TEXTUAL = 0.15;
const MIN_TEXTUAL_RESCUE = 0.35;

@ApiBearerAuth()
@ApiTags("Aides")
@Controller("aides")
@UseGuards(ApiKeyGuard)
export class AidesController {
  constructor(
    private readonly atService: AidesTerritoiresService,
    private readonly classificationService: AideClassificationService,
    private readonly matchingService: AidesMatchingService,
    private readonly textualMatchingService: AidesTextualMatchingService,
    private readonly cacheService: AidesCacheService,
    private readonly perimetreService: AidesPerimetreService,
    private readonly ajoutsManuels: AjoutsManuelsService,
    private readonly warmupService: AidesWarmupService,
    private readonly feedbackService: AidesFeedbackService,
    private readonly projetsService: GetProjetsService,
    private readonly configService: ConfigService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private readonly qualificationQueue: Queue,
    private readonly logger: CustomLogger,
  ) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Lister les aides enrichies avec classification",
    description:
      "Retourne les aides pertinentes pour un projet : filtrées par son territoire, classifiées par thématiques/sites/interventions, et triées par pertinence.\n\n**Statuts de réponse** :\n- `200 ok` : aides pertinentes trouvées\n- `200 no_match` : des aides existent sur le périmètre mais aucune n'est jugée pertinente pour le projet\n- `200 no_aides_on_perimeter` : aucune aide trouvée sur le territoire du projet\n- `202 classification_pending` : le projet n'est pas encore classifié — réessayer après `retryAfter` secondes\n- `404` : projet inexistant",
  })
  @ApiQuery({
    name: "projetId",
    required: true,
    description: "ID projet pour filtrer par territoire et calculer le matching",
    example: "019df7ce-1234-7890-abcd-ef0123456789",
  })
  @ApiQuery({
    name: "projet_id",
    required: false,
    deprecated: true,
    description: "Déprécié — utiliser `projetId` (camelCase). Sera supprimé après migration des consommateurs.",
  })
  @ApiQuery({ name: "limit", required: false, description: "Nombre max de résultats (défaut: 20)" })
  @ApiQuery({
    name: "textual",
    required: false,
    description:
      "Active une recherche de pertinence textuelle complémentaire (sur le contenu du projet et des aides). " +
      "Optionnel — désactivé par défaut.",
    example: "true",
  })
  @ApiQuery({
    name: "cutoff",
    required: false,
    description:
      "Score de pertinence minimal (0-1) sous lequel une aide est écartée du résultat. Optionnel — aucun seuil par défaut.",
    example: "0.1",
  })
  @ApiQuery({
    name: "aideThreshold",
    required: false,
    description:
      "Seuil de confiance (0-1) des labels de classification d'une aide pris en compte dans le matching. Défaut : 0.8.",
    example: "0.8",
  })
  @ApiQuery({
    name: "projetThreshold",
    required: false,
    description:
      "Seuil de confiance (0-1) des labels de classification du projet pris en compte dans le matching. Défaut : 0.8.",
    example: "0.8",
  })
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
    @Req() request: Request,
    @Query("projetId") projetIdCamel: string | undefined,
    @Res({ passthrough: true }) res: Response,
    @Query("limit") limit?: string,
    @Query("projet_id") projetIdSnake?: string,
    @Query("textual") textualOverride?: string,
    @Query("cutoff") cutoffRaw?: string,
    @Query("aideThreshold") aideThresholdRaw?: string,
    @Query("projetThreshold") projetThresholdRaw?: string,
  ): Promise<AidesListResponse | ClassificationPendingResponse> {
    const projetId = projetIdCamel ?? projetIdSnake;
    if (!projetId) {
      throw new BadRequestException("projetId is required");
    }
    if (!projetIdCamel && projetIdSnake) {
      this.logger.warn(
        `Deprecated query param projet_id used on GET /aides (use projetId instead) — projetId=${projetIdSnake}`,
      );
    }

    const maxResults = parseInt(limit ?? "20", 10);
    // Score de pertinence minimal — 0 si non fourni (= aucun filtrage par score).
    const cutoff = this.parseUnitInterval("cutoff", cutoffRaw) ?? 0;
    // Seuils de confiance des labels — undefined laisse le matcher appliquer son défaut (0.8).
    const aideThreshold = this.parseUnitInterval("aideThreshold", aideThresholdRaw);
    const projetThreshold = this.parseUnitInterval("projetThreshold", projetThresholdRaw);

    // 1. Load project (throws 404 if not found) + détecte la source pour
    //    pouvoir tagger correctement un éventuel job de classification.
    const { projet, source } = await this.projetsService.findOneWithSource(projetId);

    // 2. If not classified yet → enqueue classification + return 202
    if (!projet.classificationScores) {
      const triggered = await this.triggerClassificationIfNeeded(projetId, source);
      res.status(202).setHeader("Retry-After", String(CLASSIFICATION_RETRY_AFTER_SECONDS));
      return {
        status: "classification_pending",
        projetId,
        retryAfter: CLASSIFICATION_RETRY_AFTER_SECONDS,
        classificationTriggered: triggered,
      };
    }

    // 3. Extract code_insee from project collectivités
    const codesInsee = this.perimetreService.extractCodesInsee(projet.collectivites);

    if (codesInsee.length === 0) {
      this.logger.warn(
        `Project ${projetId} has no collectivités with code_insee, fetching aides without territory filter`,
      );
    }

    // 4. Fetch aides for each territory (union) — deduplicate by aide id
    const allAides = await this.perimetreService.fetchAidesForPerimeterCodes(codesInsee);

    // Les aides AJOUTÉES À LA MAIN sur ce projet. On les résout dans les aides du périmètre : une
    // aide n'est persistée nulle part, et Aides-territoires ne sait pas la récupérer par son id.
    // Si elle a été clôturée ou dépubliée depuis l'ajout, elle n'est plus là — elle cesse alors de
    // s'afficher, ce qui est le comportement voulu : mieux vaut ne rien montrer que d'envoyer une
    // collectivité candidater à une aide morte.
    const ajouts = await this.ajoutsManuels.actifs(projetId, "aide", request.serviceType!);

    if (allAides.length === 0) {
      return { status: "no_aides_on_perimeter", aides: [], total: 0 };
    }

    // 5. Get classifications for these aides (from DB cache)
    const aideIds = allAides.map((a) => String(a.id));
    const classifications = await this.classificationService.getCachedClassifications(aideIds);

    // 6-7. Matching thématique (+ textuel optionnel), enrichissement et tri —
    //      logique partagée avec POST /aides/recherche.
    const textualEnabled = this.isTextualMatchingEnabled(textualOverride);
    return this.buildMatchedResponse(projet.classificationScores, allAides, classifications, {
      ajouts,
      maxResults,
      cutoff,
      thresholds: { projet: projetThreshold, aide: aideThreshold },
      textualEnabled,
      textualText: `${projet.nom} ${projet.description ?? ""}`,
    });
  }

  @TrackApiUsage()
  @Post("recherche")
  @ApiOperation({
    summary: "Rechercher des aides par classification et communes",
    description:
      "Variante de `GET /aides` sans projet de référence : on fournit directement une classification (thématiques / sites / interventions, typiquement issue de `POST /qualification/classification`) et un périmètre de communes (codes INSEE). Les aides du périmètre sont matchées contre cette classification et triées par pertinence. Même périmètre par INSEE que `GET /aides`, donc même cache.\n\n**Statuts** :\n- `200 ok` : aides pertinentes trouvées\n- `200 no_match` : des aides existent sur le périmètre mais aucune n'est jugée pertinente\n- `200 no_aides_on_perimeter` : aucune aide trouvée sur les communes demandées",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: AidesListResponse,
    description: "Aides enrichies avec score de matching (status: ok | no_match | no_aides_on_perimeter)",
  })
  async searchAides(@Body() dto: AidesSearchRequest): Promise<AidesListResponse> {
    const maxResults = dto.limit ?? 20;
    const cutoff = dto.cutoff ?? 0;

    // Classification recherchée — reconstruite à partir des labels fournis.
    const searchScores: AideClassification = {
      thematiques: dto.thematiques ?? [],
      sites: dto.sites ?? [],
      interventions: dto.interventions ?? [],
    };

    // Périmètre : union des aides disponibles sur les communes demandées
    // (codes INSEE — mêmes clés de cache que GET /aides).
    const communes = [...new Set(dto.communes.map((c) => c.trim()).filter(Boolean))];
    const allAides = await this.perimetreService.fetchAidesForPerimeterCodes(communes);

    if (allAides.length === 0) {
      return { status: "no_aides_on_perimeter", aides: [], total: 0 };
    }

    const aideIds = allAides.map((a) => String(a.id));
    const classifications = await this.classificationService.getCachedClassifications(aideIds);

    // Le texte libre ne sert qu'au matching textuel optionnel.
    const textualEnabled = dto.textual === true;
    return this.buildMatchedResponse(searchScores, allAides, classifications, {
      maxResults,
      cutoff,
      thresholds: { projet: dto.projetThreshold, aide: dto.aideThreshold },
      textualEnabled,
      textualText: dto.query ?? "",
    });
  }

  /**
   * Matching thématique (+ textuel optionnel), enrichissement et tri d'un
   * ensemble d'aides contre une classification. Partagé par GET /aides et
   * POST /aides/recherche. `total` reflète le nombre d'aides du périmètre
   * avant filtrage par le matching.
   */
  private buildMatchedResponse(
    scores: AideClassification,
    allAides: Aide[],
    classifications: Map<string, AideClassification>,
    options: {
      /**
       * Ajouts manuels du projet, indexés par id d'aide. Absent sur POST /aides/recherche, qui
       * n'a pas de projet de référence : sans projet, il n'y a pas d'ajout manuel possible.
       */
      ajouts?: Map<string, { ajout: AjoutManuelResponse }>;
      maxResults: number;
      cutoff: number;
      thresholds: MatchThresholds;
      textualEnabled: boolean;
      textualText: string;
    },
  ): AidesListResponse {
    const { ajouts, maxResults, cutoff, thresholds, textualEnabled, textualText } = options;

    // Matching thématique — on passe allAides.length pour ne rien pré-trancher
    // avant la combinaison textuelle optionnelle.
    const matchResults = new Map<string, AideMatchResult>();
    for (const r of this.matchingService.match(scores, classifications, allAides.length, thresholds)) {
      matchResults.set(r.idAt, r);
    }

    // Matching textuel (BM25) — opt-in. Tourne sur toutes les aides du
    // périmètre, y compris celles non encore classifiées.
    const textualResults = textualEnabled ? this.textualMatchingService.score(textualText, allAides) : null;

    let enriched: AideWithClassification[] = allAides.map((aide) => {
      const idAt = String(aide.id);
      const classification = classifications.get(idAt);
      const match = matchResults.get(idAt);

      const base: AideWithClassification = {
        ...aide,
        classification: classification ?? undefined,
        matchingScore: match?.score,
        normalizedScore: match?.normalizedScore,
        axesMatched: match?.axesMatched,
        labelsCommuns: match?.labelsCommuns,
      };

      if (!textualResults) return base;

      const textual = textualResults.get(idAt);
      const thematicScore = match?.normalizedScore ?? 0;
      const textualScore = textual?.score ?? 0;
      return {
        ...base,
        textualScore,
        combinedScore: W_THEMATIC * thematicScore + W_TEXTUAL * textualScore,
        matchedTerms: textual?.matchedTerms,
      };
    });

    if (textualEnabled) {
      // Rescue + booster : on garde tout match thématique, plus toute aide
      // dont le score textuel dépasse le plancher de rescue. Tri par score combiné.
      // Le cutoff écarte les aides sous le score de pertinence minimal demandé.
      enriched = enriched
        .filter(
          (a) =>
            (a.matchingScore !== undefined || (a.textualScore ?? 0) >= MIN_TEXTUAL_RESCUE) &&
            (a.combinedScore ?? 0) >= cutoff,
        )
        .sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0))
        .slice(0, maxResults);
    } else {
      // Comportement historique : matching thématique seul.
      // Le cutoff filtre sur le score de pertinence normalisé (0-1).
      enriched = enriched
        .filter((a) => a.matchingScore !== undefined && (a.normalizedScore ?? 0) >= cutoff)
        .sort((a, b) => (b.matchingScore ?? 0) - (a.matchingScore ?? 0))
        .slice(0, maxResults);
    }

    // Les ajouts manuels EN TÊTE, et ils échappent au cutoff comme au maxResults : quelqu'un les a
    // délibérément mis là, précisément parce que le moteur les ratait. Les soumettre au filtre qui
    // les a ratés serait absurde.
    //
    // Un ajout qui n'est plus sur le périmètre (aide clôturée, dépubliée) n'apparaît simplement
    // pas : on ne peut pas le résoudre, et on ne fabrique rien.
    const manuels: AideWithClassification[] = [];
    if (ajouts && ajouts.size > 0) {
      const parId = new Map(allAides.map((a) => [String(a.id), a]));
      for (const [idAt, { ajout }] of ajouts) {
        const aide = parId.get(idAt);
        if (!aide) continue;
        manuels.push({
          ...aide,
          classification: classifications.get(idAt) ?? undefined,
          ajoutManuel: ajout,
        });
      }
      manuels.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Un ajout manuel qui serait AUSSI remonté par le moteur ne doit apparaître qu'une fois — avec
    // sa marque d'ajout. Le dédoublonnage se fait ici, pas dans le client.
    const idsManuels = new Set(manuels.map((a) => String(a.id)));
    const duMoteur = enriched.filter((a) => !idsManuels.has(String(a.id)));
    const aides = [...manuels, ...duMoteur];

    if (aides.length === 0) {
      return { status: "no_match", aides: [], total: allAides.length };
    }

    return { status: "ok", aides, total: allAides.length };
  }

  /**
   * Le matching textuel est opt-in. Override par requête (`?textual=true|false`)
   * sinon flag d'env `AIDES_TEXTUAL_MATCHING_ENABLED` (défaut désactivé).
   */
  private isTextualMatchingEnabled(override?: string): boolean {
    if (override === "true") return true;
    if (override === "false") return false;
    return this.configService.get<string>("AIDES_TEXTUAL_MATCHING_ENABLED") === "true";
  }

  /**
   * Parse un paramètre de score dans [0, 1]. Renvoie undefined si absent,
   * lève une 400 explicite si la valeur est invalide.
   */
  private parseUnitInterval(name: string, raw: string | undefined): number | undefined {
    if (raw === undefined || raw === "") return undefined;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0 || value > 1) {
      throw new BadRequestException(`Paramètre "${name}" invalide : attendu un nombre entre 0 et 1, reçu "${raw}"`);
    }
    return value;
  }

  /**
   * Enqueue a classification job for the project if none is already pending or active.
   * Uses a deterministic jobId so concurrent polls from MEC don't pile up duplicate jobs.
   * Le payload du job dépend de la source du projet pour que le processor
   * (projet-qualification.service.ts) écrive dans la bonne table :
   *   - public        → { projetId }                  → analyzeAndUpdateClassification (public.projets)
   *   - data_mec      → { projetId, schema: "data_mec" } → classifyMecProjet (data_mec.projets_operationnels)
   *   - data_tet      → { ficheActionId: projetId }   → classifyFicheAction (data_tet.fiches_action)
   * Returns true if a new job was enqueued, false if one was already in flight.
   */
  private async triggerClassificationIfNeeded(projetId: string, source: ProjetSource): Promise<boolean> {
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

    const jobData = this.buildClassificationJobData(projetId, source);

    await this.qualificationQueue.add(PROJECT_QUALIFICATION_CLASSIFICATION_JOB, jobData, {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    this.logger.log(`Enqueued classification job for ${projetId} (source: ${source}, triggered by GET /aides)`);
    return true;
  }

  private buildClassificationJobData(
    projetId: string,
    source: ProjetSource,
  ): { projetId?: string; ficheActionId?: string; schema?: string } {
    switch (source) {
      case "data_tet":
        return { ficheActionId: projetId };
      case "data_mec":
        return { projetId, schema: "data_mec" };
      case "public":
        return { projetId };
    }
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
  @ApiEndpointResponses({ successStatus: 201, response: AideFeedbackResponse })
  async createFeedback(@Body() dto: CreateAideFeedbackRequest): Promise<AideFeedbackResponse> {
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
  @ApiEndpointResponses({ successStatus: 200, response: AideFeedbackResponse, isArray: true })
  async getFeedbacks(@Query("projetId", new ParseUUIDPipe()) projetId: string): Promise<AideFeedbackResponse[]> {
    return this.feedbackService.findByProjet(projetId);
  }

  @TrackApiUsage()
  @Delete("feedback")
  @ApiOperation({ summary: "Annuler un feedback" })
  @HttpCode(204)
  @ApiEndpointResponses({ successStatus: 204 })
  async deleteFeedback(@Body() dto: DeleteAideFeedbackRequest): Promise<void> {
    return this.feedbackService.delete(dto.projetId, dto.idAt);
  }

  /**
   * Extract unique code_insee values from project collectivités (Communes only)
   */
}
