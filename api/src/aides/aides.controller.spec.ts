/* eslint-disable @typescript-eslint/unbound-method */
import { Response } from "express";
import { Queue } from "bullmq";
import { AidesController } from "./aides.controller";
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
      findOne: jest.fn().mockResolvedValue({
        id: "test-id",
        collectivites: [{ type: "Commune", codeInsee: "44109" }],
        classificationScores: { thematiques: [], sites: [], interventions: [] },
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

    controller = new AidesController(
      mockAtService,
      mockClassificationService,
      mockMatchingService,
      mockTextualMatchingService,
      mockCacheService,
      mockWarmupService,
      mockFeedbackService,
      mockProjetsService,
      mockConfigService,
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

      await controller.listAides("test-id", makeRes().res);

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

      await controller.listAides("test-id", makeRes().res);

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
        controller.listAides("test-id", makeRes().res),
        controller.listAides("test-id", makeRes().res),
      ]);

      await new Promise((r) => setTimeout(r, 100));

      // Only ONE background refresh should have been triggered
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(1);
    });

    it("should fetch synchronously on cache miss (cold start)", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAtService.fetchAides.mockResolvedValue([makeAide(1)]);

      await controller.listAides("test-id", makeRes().res);

      expect(mockAtService.fetchAides).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe("listAides response statuses", () => {
    it("should return 202 + classification_pending and enqueue a job when project is unclassified", async () => {
      mockProjetsService.findOne.mockResolvedValue({
        id: "test-id",
        collectivites: [{ type: "Commune", codeInsee: "44109" }],
        classificationScores: null,
      } as never);

      const { res, statusSpy, headerSpy } = makeRes();
      const result = (await controller.listAides("test-id", res)) as ClassificationPendingResponse;

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

    it("should not re-enqueue when a classification job is already in flight", async () => {
      mockProjetsService.findOne.mockResolvedValue({
        id: "test-id",
        collectivites: [{ type: "Commune", codeInsee: "44109" }],
        classificationScores: null,
      } as never);

      mockQualificationQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue("active"),
        remove: jest.fn(),
      } as never);

      const { res } = makeRes();
      const result = (await controller.listAides("test-id", res)) as ClassificationPendingResponse;

      expect(result.classificationTriggered).toBe(false);
      expect(mockQualificationQueue.add).not.toHaveBeenCalled();
    });

    it("should remove a stale completed/failed job before re-enqueuing", async () => {
      mockProjetsService.findOne.mockResolvedValue({
        id: "test-id",
        collectivites: [{ type: "Commune", codeInsee: "44109" }],
        classificationScores: null,
      } as never);

      const removeSpy = jest.fn();
      mockQualificationQueue.getJob.mockResolvedValue({
        getState: jest.fn().mockResolvedValue("failed"),
        remove: removeSpy,
      } as never);

      const { res } = makeRes();
      const result = (await controller.listAides("test-id", res)) as ClassificationPendingResponse;

      expect(removeSpy).toHaveBeenCalled();
      expect(mockQualificationQueue.add).toHaveBeenCalled();
      expect(result.classificationTriggered).toBe(true);
    });

    it("should return no_aides_on_perimeter when AT returns 0 aides on the project's INSEE codes", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [], status: "fresh" });
      mockAtService.fetchAides.mockResolvedValue([]);

      const { res } = makeRes();
      const result = (await controller.listAides("test-id", res)) as AidesListResponse;

      expect(result.status).toBe("no_aides_on_perimeter");
      expect(result.aides).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should return no_match when aides exist on perimeter but none share a label ≥ 0.8", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      // matchingService returns [] → no aide passes the matching filter
      mockMatchingService.match.mockReturnValue([]);

      const { res } = makeRes();
      const result = (await controller.listAides("test-id", res)) as AidesListResponse;

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
      const result = (await controller.listAides("test-id", res)) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(result.aides).toHaveLength(1);
      expect(result.aides[0].matchingScore).toBe(0.5);
      expect(result.total).toBe(2);
    });
  });

  describe("listAides textual matching", () => {
    it("should NOT call the textual service when the flag is off (default)", async () => {
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides("test-id", makeRes().res);

      expect(mockTextualMatchingService.score).not.toHaveBeenCalled();
    });

    it("should call the textual service when AIDES_TEXTUAL_MATCHING_ENABLED is true", async () => {
      mockConfigService.get.mockReturnValue("true");
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides("test-id", makeRes().res);

      expect(mockTextualMatchingService.score).toHaveBeenCalled();
    });

    it("should rescue an aide with no thematic match but a textual score above the floor", async () => {
      mockConfigService.get.mockReturnValue("true");
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1), makeAide(2)], status: "fresh" });
      mockMatchingService.match.mockReturnValue([]); // aucun match thématique
      mockTextualMatchingService.score.mockReturnValue(
        new Map([
          ["1", { score: 0.5, matchedTerms: ["renovation"] }], // ≥ 0.2 → rescue
          ["2", { score: 0.05, matchedTerms: [] }], // < 0.2 → écartée
        ]),
      );

      const result = (await controller.listAides("test-id", makeRes().res)) as AidesListResponse;

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

      const result = (await controller.listAides("test-id", makeRes().res)) as AidesListResponse;

      // combiné : aide2 = 0.7*0.9 + 0.3*0.1 = 0.66 ; aide1 = 0.7*0 + 0.3*0.9 = 0.27
      expect(result.aides.map((a) => a.id)).toEqual([2, 1]);
    });

    it("should honor ?textual=true override even when the env flag is off", async () => {
      mockConfigService.get.mockReturnValue(undefined); // flag env off
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides("test-id", makeRes().res, undefined, undefined, "true");

      expect(mockTextualMatchingService.score).toHaveBeenCalled();
    });

    it("should honor ?textual=false override even when the env flag is on", async () => {
      mockConfigService.get.mockReturnValue("true"); // flag env on
      mockCacheService.get.mockResolvedValue({ aides: [makeAide(1)], status: "fresh" });

      await controller.listAides("test-id", makeRes().res, undefined, undefined, "false");

      expect(mockTextualMatchingService.score).not.toHaveBeenCalled();
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
      const result = (await controller.listAides("test-id", res)) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(mockProjetsService.findOne).toHaveBeenCalledWith("test-id");
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Deprecated query param projet_id"));
    });

    it("should accept projet_id (snake_case, deprecated) and log a warning", async () => {
      const { res } = makeRes();
      const result = (await controller.listAides(undefined, res, undefined, "test-id")) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(mockProjetsService.findOne).toHaveBeenCalledWith("test-id");
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Deprecated query param projet_id"));
    });

    it("should prefer projetId when both are provided (no warning)", async () => {
      const { res } = makeRes();
      const result = (await controller.listAides("camel-id", res, undefined, "snake-id")) as AidesListResponse;

      expect(result.status).toBe("ok");
      expect(mockProjetsService.findOne).toHaveBeenCalledWith("camel-id");
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining("Deprecated query param projet_id"));
    });

    it("should throw 400 when neither projetId nor projet_id is provided", async () => {
      const { res } = makeRes();
      await expect(controller.listAides(undefined, res)).rejects.toThrow("projetId is required");
    });
  });
});
