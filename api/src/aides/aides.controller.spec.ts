/* eslint-disable @typescript-eslint/unbound-method */
import { Response } from "express";
import { Queue } from "bullmq";
import type { Request as ExpressRequest } from "express";
import { AidesController } from "./aides.controller";
import { AidesPerimetreService } from "./aides-perimetre.service";
import { AidesMoteurService } from "./aides-moteur.service";
import { AidesProjetService } from "./aides-projet.service";
import { AjoutsManuelsService } from "@/ajouts-manuels/ajouts-manuels.service";
import { AidesTerritoiresService } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesTextualMatchingService } from "./aides-textual-matching.service";
import { AidesCacheService, CacheResult } from "./aides-cache.service";
import { ConfigService } from "@nestjs/config";
import { AidesWarmupService } from "./aides-warmup.service";
import { AidesFeedbackService } from "./aides-feedback.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { CustomLogger } from "@logging/logger.service";
import { Aide, AidesListResponse, ClassificationPendingResponse } from "./dto/aides.dto";
import { PROJECT_QUALIFICATION_CLASSIFICATION_JOB } from "@/projet-qualification/const";

const makeRes = () => {
  const statusSpy = jest.fn().mockReturnThis();
  const headerSpy = jest.fn().mockReturnThis();
  const res = {
    status: statusSpy,
    setHeader: headerSpy,
  } as unknown as Response;
  return { res, statusSpy, headerSpy };
};

function makeAide(id: number): Aide {
  return {
    id,
    slug: `aide-${id}`,
    url: `/aides/${id}/`,
    name: `Aide ${id}`,
    name_initial: `Aide ${id}`,
    short_title: null,
    financers: [],
    financers_full: [],
    instructors: [],
    programs: [],
    description: null,
    eligibility: null,
    perimeter: "France",
    perimeter_id: 1,
    perimeter_scale: "country",
    categories: [],
    targeted_audiences: [],
    aid_types: [],
    aid_types_full: [],
    mobilization_steps: [],
    origin_url: null,
    application_url: null,
    is_call_for_project: false,
    start_date: null,
    submission_deadline: null,
    subvention_rate_lower_bound: null,
    subvention_rate_upper_bound: null,
    subvention_comment: null,
    contact: null,
    recurrence: null,
    project_examples: null,
    date_created: null,
    date_updated: null,
  };
}

/** La plateforme est dérivée de la clé d'API par le garde ; en test on la pose directement. */
const makeReq = () => ({ serviceType: "MEC" }) as unknown as ExpressRequest;

describe("AidesController", () => {
  let controller: AidesController;
  let mockAtService: jest.Mocked<AidesTerritoiresService>;
  let mockCacheService: jest.Mocked<AidesCacheService>;
  let mockWarmupService: jest.Mocked<AidesWarmupService>;
  let mockClassificationService: jest.Mocked<AideClassificationService>;
  let mockMatchingService: jest.Mocked<AidesMatchingService>;
  let mockTextualMatchingService: jest.Mocked<AidesTextualMatchingService>;
  let mockFeedbackService: jest.Mocked<AidesFeedbackService>;
  let mockProjetsService: jest.Mocked<GetProjetsService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockQualificationQueue: jest.Mocked<Queue>;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as CustomLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAtService = {
      fetchAides: jest.fn().mockResolvedValue([makeAide(1), makeAide(2)]),
    } as unknown as jest.Mocked<AidesTerritoiresService>;

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      buildKey: jest.fn().mockReturnValue("perimeter_codes%5B%5D=44109"),
      invalidateTerritories: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AidesCacheService>;

    mockWarmupService = {
      warmup: jest.fn().mockResolvedValue({ territories: 3, duration: 5000 }),
    } as unknown as jest.Mocked<AidesWarmupService>;

    mockClassificationService = {
      getCachedClassifications: jest.fn().mockResolvedValue(new Map()),
      syncClassifications: jest.fn().mockResolvedValue({ classified: 0, cached: 0 }),
    } as unknown as jest.Mocked<AideClassificationService>;

    mockMatchingService = {
      match: jest.fn().mockReturnValue([]),
    } as unknown as jest.Mocked<AidesMatchingService>;

    mockTextualMatchingService = {
      score: jest.fn().mockReturnValue(new Map()),
    } as unknown as jest.Mocked<AidesTextualMatchingService>;

    // Flag textuel désactivé par défaut → chemin historique inchangé.
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    mockProjetsService = {
      findOneWithSource: jest.fn().mockResolvedValue({
        projet: {
          id: "test-id",
          collectivites: [{ type: "Commune", codeInsee: "44109" }],
          classificationScores: { thematiques: [], sites: [], interventions: [] },
        },
        source: "public",
      }),
    } as unknown as jest.Mocked<GetProjetsService>;

    mockQualificationQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue({ id: "auto-classify:test-id" }),
    } as unknown as jest.Mocked<Queue>;

    mockFeedbackService = {
      create: jest.fn(),
      findByProjet: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AidesFeedbackService>;

    // Le VRAI service de périmètre, construit sur les mêmes mocks : la logique SWR a changé de
    // maison (elle était privée dans le contrôleur), pas de comportement. Les tests ci-dessous la
    // valident donc toujours réellement, au lieu de valider un mock.
    const perimetreService = new AidesPerimetreService(mockAtService, mockCacheService, mockLogger);

    // Aucun ajout manuel par défaut : ces tests portent sur le moteur.
    const mockAjoutsManuels = {
      actifs: jest.fn().mockResolvedValue(new Map()),
    } as unknown as jest.Mocked<AjoutsManuelsService>;

    // Le VRAI moteur, construit sur les mêmes mocks : il a quitté le contrôleur, pas le
    // comportement. Les tests continuent donc de le valider réellement.
    const moteur = new AidesMoteurService(mockMatchingService, mockTextualMatchingService, mockConfigService);

    // Le VRAI service d'orchestration, sur les mêmes mocks : il a quitté le contrôleur, pas le
    // comportement. Les tests continuent donc de valider la chaîne réelle.
    const aidesProjet = new AidesProjetService(
      mockProjetsService,
      perimetreService,
      mockClassificationService,
      moteur,
      mockAjoutsManuels,
      mockLogger,
    );

    controller = new AidesController(
      mockAtService,
      mockClassificationService,
      mockCacheService,
      perimetreService,
      moteur,
      aidesProjet,
      mockWarmupService,
      mockFeedbackService,
      mockProjetsService,
      mockQualificationQueue,
      mockLogger,
    );
  });

  describe("SWR behavior in fetchAidesForTerritories", () => {
    it("should serve from cache on fresh hit without calling AT", async () => {
      const freshResult: CacheResult = {
        aides: [makeAide(1), makeAide(2)],
        status: "fresh",
      };
      mockCacheService.get.mockResolvedValue(freshResult);

      await controller.listAides(makeReq(), "test-id", makeRes().res);

      expect(mockAtService.fetchAides).not.toHaveBeenCalled();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it("should serve stale data and trigger background refresh", async () => {
      const staleResult: CacheResult = {
        aides: [makeAide(1)],
        status: "stale",
      };
      mockCacheService.get.mockResolvedValue(staleResult);
      mockAtService.fetchAides.mockResolvedValue([makeAide(1), makeAide(2)]);

      await controller.listAides(makeReq(), "test-id", makeRes().res);

      // Background refresh is fire-and-forget — wait a tick
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAtService.fetchAides).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should deduplicate concurrent background refreshes for the same key", async () => {
      const staleResult: CacheResult = {
        aides: [makeAide(1)],
        status: "stale",
      };
      mockCacheService.get.mockResolvedValue(staleResult);

      // Slow refresh to ensure both calls overlap
      mockAtService.fetchAides.mockImplementation(() => new Promise((r) => setTimeout(() => r([makeAide(1)]), 50)));

      // Two concurrent requests for the same stale territory
      await Promise.all([
        controller.listAides(makeReq(), "test-id", makeRes().res),
        controller.listAides(makeReq(), "test-id", makeRes().res),
      ]);

      await new Promise((r) => setTimeout(r, 100));

      // Only ONE background refresh should have been triggered
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(1);
    });

    it("should fetch synchronously on cache miss (cold start)", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAtService.fetchAides.mockResolvedValue([makeAide(1)]);

      await controller.listAides(makeReq(), "test-id", makeRes().res);

      expect(mockAtService.fetchAides).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe("listAides response statuses", () => {
    it("should return 202 + classification_pending and enqueue a job when project is unclassified", async () => {
      mockProjetsService.findOneWithSource.mockResolvedValue({
        projet: {
          id: "test-id",
          collectivites: [{ type: "Commune", codeInsee: "44109" }],
          classificationScores: null,
        },
        source: "public",
      } as never);

      const { res, statusSpy, headerSpy } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as ClassificationPendingResponse;

      expect(statusSpy).toHaveBeenCalledWith(202);
      expect(headerSpy).toHaveBeenCalledWith("Retry-After", "15");
      expect(result.status).toBe("classification_pending");
      expect(result.projetId).toBe("test-id");
      expect(result.retryAfter).toBe(15);
      expect(result.classificationTriggered).toBe(true);
      expect(mockQualificationQueue.add).toHaveBeenCalledWith(
        PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
        { projetId: "test-id" },
        expect.objectContaining({ jobId: "auto-classify:test-id" }),
      );
    });

    it("should tag the classification job with schema=data_mec when projet comes from data_mec", async () => {
      mockProjetsService.findOneWithSource.mockResolvedValue({
        projet: {
          id: "test-id",
          collectivites: [{ type: "Commune", codeInsee: "44109" }],
          classificationScores: null,
        },
        source: "data_mec",
      } as never);

      const { res } = makeRes();
      await controller.listAides(makeReq(), "test-id", res);

      expect(mockQualificationQueue.add).toHaveBeenCalledWith(
        PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
        { projetId: "test-id", schema: "data_mec" },
        expect.objectContaining({ jobId: "auto-classify:test-id" }),
      );
    });

    it("should tag the classification job as ficheActionId when projet comes from data_tet", async () => {
      mockProjetsService.findOneWithSource.mockResolvedValue({
        projet: {
          id: "test-id",
          collectivites: [{ type: "Commune", codeInsee: "44109" }],
          classificationScores: null,
        },
        source: "data_tet",
      } as never);

      const { res } = makeRes();
      await controller.listAides(makeReq(), "test-id", res);

      expect(mockQualificationQueue.add).toHaveBeenCalledWith(
        PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
        { ficheActionId: "test-id" },
        expect.objectContaining({ jobId: "auto-classify:test-id" }),
      );
    });

    it("should not re-enqueue when a classification job is already in flight", async () => {
      mockProjetsService.findOneWithSource.mockResolvedValue({
        projet: {
          id: "test-id",
          collectivites: [{ type: "Commune", codeInsee: "44109" }],
          classificationScores: null,
        },
        source: "public",
      } as never);

      mockQualificationQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue("active"),
        remove: jest.fn(),
      } as never);

      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as ClassificationPendingResponse;

      expect(result.classificationTriggered).toBe(false);
      expect(mockQualificationQueue.add).not.toHaveBeenCalled();
    });

    it("should remove a stale completed/failed job before re-enqueuing", async () => {
      mockProjetsService.findOneWithSource.mockResolvedValue({
        projet: {
          id: "test-id",
          collectivites: [{ type: "Commune", codeInsee: "44109" }],
          classificationScores: null,
        },
        source: "public",
      } as never);

      const removeSpy = jest.fn();
      mockQualificationQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue("failed"),
        remove: removeSpy,
      } as never);

      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as ClassificationPendingResponse;

      expect(removeSpy).toHaveBeenCalled();
      expect(mockQualificationQueue.add).toHaveBeenCalled();
      expect(result.classificationTriggered).toBe(true);
    });

    it("should return no_aides_on_perimeter when AT returns 0 aides on the project's INSEE codes", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [], status: "fresh" });
      mockAtService.fetchAides.mockResolvedValue([]);

      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as AidesListResponse;

      expect(result.status).toBe("no_aides_on_perimeter");
      expect(result.aides).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should return no_match when aides exist on perimeter but none share a label ≥ 0.8", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      // matchingService returns [] → no aide passes the matching filter
      mockMatchingService.match.mockReturnValue([]);

      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as AidesListResponse;

      expect(result.status).toBe("no_match");
      expect(result.aides).toEqual([]);
      expect(result.total).toBe(2);
    });

    it("should return ok when matching aides are found", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([
        {
          idAt: "1",
          score: 0.5,
          normalizedScore: 0.5,
          scoreThematiques: 0.5,
          scoreSites: 0,
          scoreInterventions: 0,
          axesMatched: 1,
          labelsCommuns: { thematiques: ["X"], sites: [], interventions: [] },
        },
      ]);

      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(result.aides).toHaveLength(1);
      expect(result.aides[0].matchingScore).toBe(0.5);
      expect(result.total).toBe(2);
    });
  });

  describe("searchAides (POST /aides/recherche)", () => {
    const baseDto = {
      thematiques: [{ label: "Rénovation énergétique", score: 0.9 }],
      sites: [],
      interventions: [],
      communes: ["44109"],
    };

    it("fetches aides by commune INSEE perimeter code (not via a projet)", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.searchAides({ ...baseDto });

      // Pas de résolution de projet : on ne touche pas au registre projets.
      expect(mockProjetsService.findOneWithSource).not.toHaveBeenCalled();
      // Le matching reçoit bien la classification fournie en entrée.
      expect(mockMatchingService.match).toHaveBeenCalledWith(
        { thematiques: baseDto.thematiques, sites: [], interventions: [] },
        expect.any(Map),
        expect.any(Number),
        expect.any(Object),
      );
    });

    it("dedupes communes and queries AT once per unique perimeter code", async () => {
      // Cache miss → fetch synchrone par code de périmètre.
      mockCacheService.get.mockResolvedValue(null);
      mockAtService.fetchAides.mockResolvedValue([makeAide(1)]);

      await controller.searchAides({ ...baseDto, communes: ["44109", "44109", "75056"] });

      // 2 codes uniques → 2 appels AT.
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(2);
      expect(mockAtService.fetchAides).toHaveBeenCalledWith({ "perimeter_codes[]": "44109" });
      expect(mockAtService.fetchAides).toHaveBeenCalledWith({ "perimeter_codes[]": "75056" });
    });

    it("returns no_aides_on_perimeter when AT returns nothing on the communes", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [], status: "fresh" });
      mockAtService.fetchAides.mockResolvedValue([]);

      const result = await controller.searchAides({ ...baseDto });

      expect(result.status).toBe("no_aides_on_perimeter");
      expect(result.total).toBe(0);
    });

    it("returns no_match when aides exist but none is relevant", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([]);

      const result = await controller.searchAides({ ...baseDto });

      expect(result.status).toBe("no_match");
      expect(result.total).toBe(2);
    });

    it("returns ok with aides sorted by relevance", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([
        {
          idAt: "2",
          score: 0.8,
          normalizedScore: 0.8,
          scoreThematiques: 0.8,
          scoreSites: 0,
          scoreInterventions: 0,
          axesMatched: 1,
          labelsCommuns: { thematiques: ["Rénovation énergétique"], sites: [], interventions: [] },
        },
        {
          idAt: "1",
          score: 0.3,
          normalizedScore: 0.3,
          scoreThematiques: 0.3,
          scoreSites: 0,
          scoreInterventions: 0,
          axesMatched: 1,
          labelsCommuns: { thematiques: ["Rénovation énergétique"], sites: [], interventions: [] },
        },
      ]);

      const result = await controller.searchAides({ ...baseDto });

      expect(result.status).toBe("ok");
      expect(result.aides).toHaveLength(2);
      expect(result.aides[0].id).toBe(2); // meilleur score en tête
      expect(result.total).toBe(2);
    });

    it("forwards the per-side thresholds to the matching service", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.searchAides({ ...baseDto, aideThreshold: 0.7, projetThreshold: 0.3 });

      expect(mockMatchingService.match).toHaveBeenCalledWith(expect.anything(), expect.any(Map), expect.any(Number), {
        projet: 0.3,
        aide: 0.7,
      });
    });

    it("runs textual matching only when textual=true", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.searchAides({ ...baseDto, textual: false });
      expect(mockTextualMatchingService.score).not.toHaveBeenCalled();

      await controller.searchAides({ ...baseDto, textual: true, query: "rénovation" });
      expect(mockTextualMatchingService.score).toHaveBeenCalledWith("rénovation", expect.any(Array));
    });
  });

  describe("listAides textual matching", () => {
    it("should NOT call the textual service when the flag is off (default)", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides(makeReq(), "test-id", makeRes().res);

      expect(mockTextualMatchingService.score).not.toHaveBeenCalled();
    });

    it("should call the textual service when AIDES_TEXTUAL_MATCHING_ENABLED is true", async () => {
      mockConfigService.get.mockReturnValue("true");
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides(makeReq(), "test-id", makeRes().res);

      expect(mockTextualMatchingService.score).toHaveBeenCalled();
    });

    it("should rescue an aide with no thematic match but a textual score above the floor", async () => {
      mockConfigService.get.mockReturnValue("true");
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([]); // aucun match thématique
      mockTextualMatchingService.score.mockReturnValue(
        new Map([
          ["1", { score: 0.5, matchedTerms: ["renovation"] }], // ≥ 0.35 → rescue
          ["2", { score: 0.05, matchedTerms: [] }], // < 0.35 → écartée
        ]),
      );

      const result = (await controller.listAides(makeReq(), "test-id", makeRes().res)) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(result.aides).toHaveLength(1);
      expect(result.aides[0].id).toBe(1);
      expect(result.aides[0].textualScore).toBe(0.5);
    });

    it("should sort by combinedScore (thematic + textual)", async () => {
      mockConfigService.get.mockReturnValue("true");
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      // Aide 2 a un meilleur score thématique, aide 1 un meilleur textuel.
      mockMatchingService.match.mockReturnValue([
        {
          idAt: "2",
          score: 0.9,
          normalizedScore: 0.9,
          scoreThematiques: 0.9,
          scoreSites: 0,
          scoreInterventions: 0,
          axesMatched: 1,
          labelsCommuns: { thematiques: ["X"], sites: [], interventions: [] },
        },
      ]);
      mockTextualMatchingService.score.mockReturnValue(
        new Map([
          ["1", { score: 0.9, matchedTerms: ["a"] }],
          ["2", { score: 0.1, matchedTerms: [] }],
        ]),
      );

      const result = (await controller.listAides(makeReq(), "test-id", makeRes().res)) as AidesListResponse;

      // combiné : aide2 = 0.85*0.9 + 0.15*0.1 = 0.78 ; aide1 = 0.85*0 + 0.15*0.9 = 0.135
      expect(result.aides.map((a) => a.id)).toEqual([2, 1]);
    });

    it("should honor ?textual=true override even when the env flag is off", async () => {
      mockConfigService.get.mockReturnValue(undefined); // flag env off
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides(makeReq(), "test-id", makeRes().res, undefined, undefined, "true");

      expect(mockTextualMatchingService.score).toHaveBeenCalled();
    });

    it("should honor ?textual=false override even when the env flag is on", async () => {
      mockConfigService.get.mockReturnValue("true"); // flag env on
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides(makeReq(), "test-id", makeRes().res, undefined, undefined, "false");

      expect(mockTextualMatchingService.score).not.toHaveBeenCalled();
    });
  });

  describe("listAides cutoff & thresholds", () => {
    const matchResult = (idAt: string, score: number, normalizedScore: number) => ({
      idAt,
      score,
      normalizedScore,
      scoreThematiques: score,
      scoreSites: 0,
      scoreInterventions: 0,
      axesMatched: 1,
      labelsCommuns: { thematiques: ["X"], sites: [], interventions: [] },
    });

    it("filters out aides whose normalized score is below the cutoff", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([
        matchResult("1", 0.5, 0.5), // ≥ 0.1 → gardée
        matchResult("2", 0.05, 0.05), // < 0.1 → écartée
      ]);

      // cutoff = 6e argument
      const result = (await controller.listAides(
        makeReq(),
        "test-id",
        makeRes().res,
        undefined,
        undefined,
        undefined,
        "0.1",
      )) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(result.aides.map((a) => a.id)).toEqual([1]);
    });

    it("keeps every matched aide when no cutoff is provided", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([matchResult("1", 0.5, 0.5), matchResult("2", 0.05, 0.05)]);

      const result = (await controller.listAides(makeReq(), "test-id", makeRes().res)) as AidesListResponse;

      expect(result.aides.map((a) => a.id)).toEqual([1, 2]);
    });

    it("passes aideThreshold and projetThreshold to the matching service", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides(
        makeReq(),
        "test-id",
        makeRes().res,
        undefined,
        undefined,
        undefined,
        undefined,
        "0.7",
        "0.6",
      );

      expect(mockMatchingService.match).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(Number), {
        projet: 0.6,
        aide: 0.7,
      });
    });

    it("leaves thresholds undefined when the params are absent (matcher applies its default)", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides(makeReq(), "test-id", makeRes().res);

      expect(mockMatchingService.match).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.any(Number), {
        projet: undefined,
        aide: undefined,
      });
    });

    it("rejects an out-of-range score parameter with 400", async () => {
      await expect(
        controller.listAides(makeReq(), "test-id", makeRes().res, undefined, undefined, undefined, "1.5"),
      ).rejects.toThrow();
    });
  });

  describe("syncClassifications", () => {
    it("should invalidate territories and trigger warmup in background", async () => {
      const result = await controller.syncClassifications();

      expect(mockCacheService.invalidateTerritories).toHaveBeenCalled();
      expect(mockWarmupService.warmup).toHaveBeenCalled();
      expect(result.warmupStarted).toBe(true);
      // warmup is fire-and-forget, not awaited
      expect(result).not.toHaveProperty("warmup");
    });
  });

  describe("feedback endpoints", () => {
    const projetId = "019df7ce-1234-7890-abcd-ef0123456789";

    it("createFeedback should delegate to feedbackService.create", async () => {
      const dto = { projetId, idAt: "12345", reason: "wrong_territory" };
      const created = {
        id: "00000000-0000-0000-0000-000000000001",
        projetId,
        idAt: "12345",
        feedback: "not_relevant",
        reason: "wrong_territory",
        source: "MEC",
        createdAt: new Date(),
      };
      mockFeedbackService.create.mockResolvedValue(created);

      const result = await controller.createFeedback(dto);

      expect(mockFeedbackService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });

    it("getFeedbacks should delegate to feedbackService.findByProjet", async () => {
      const feedbacks = [
        {
          id: "00000000-0000-0000-0000-000000000001",
          projetId,
          idAt: "12345",
          feedback: "not_relevant",
          reason: null,
          source: "MEC",
          createdAt: new Date(),
        },
      ];
      mockFeedbackService.findByProjet.mockResolvedValue(feedbacks);

      const result = await controller.getFeedbacks(projetId);

      expect(mockFeedbackService.findByProjet).toHaveBeenCalledWith(projetId);
      expect(result).toEqual(feedbacks);
    });

    it("deleteFeedback should delegate to feedbackService.delete", async () => {
      mockFeedbackService.delete.mockResolvedValue(undefined);

      await controller.deleteFeedback({ projetId, idAt: "12345" });

      expect(mockFeedbackService.delete).toHaveBeenCalledWith(projetId, "12345");
    });
  });

  describe("listAides projetId param compat", () => {
    beforeEach(() => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([
        {
          idAt: "1",
          score: 0.5,
          normalizedScore: 0.5,
          scoreThematiques: 0.5,
          scoreSites: 0,
          scoreInterventions: 0,
          axesMatched: 1,
          labelsCommuns: { thematiques: ["X"], sites: [], interventions: [] },
        },
      ]);
    });

    it("should accept projetId (camelCase, canonical) without warning", async () => {
      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), "test-id", res)) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(mockProjetsService.findOneWithSource).toHaveBeenCalledWith("test-id");
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Deprecated query param projet_id"));
    });

    it("should accept projet_id (snake_case, deprecated) and log a warning", async () => {
      const { res } = makeRes();
      const result = (await controller.listAides(makeReq(), undefined, res, undefined, "test-id")) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(mockProjetsService.findOneWithSource).toHaveBeenCalledWith("test-id");
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Deprecated query param projet_id"));
    });

    it("should prefer projetId when both are provided (no warning)", async () => {
      const { res } = makeRes();
      const result = (await controller.listAides(
        makeReq(),
        "camel-id",
        res,
        undefined,
        "snake-id",
      )) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(mockProjetsService.findOneWithSource).toHaveBeenCalledWith("camel-id");
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Deprecated query param projet_id"));
    });

    it("should throw 400 when neither projetId nor projet_id is provided", async () => {
      const { res } = makeRes();
      await expect(controller.listAides(makeReq(), undefined, res)).rejects.toThrow("projetId is required");
    });
  });
});
