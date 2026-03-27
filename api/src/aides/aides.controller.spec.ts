/* eslint-disable @typescript-eslint/unbound-method */
import { AidesController } from "./aides.controller";
import { AidesTerritoiresService, AideTerritoires } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesCacheService, CacheResult } from "./aides-cache.service";
import { AidesWarmupService } from "./aides-warmup.service";
import { DatabaseService } from "@database/database.service";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { CustomLogger } from "@logging/logger.service";

function makeAide(id: number): AideTerritoires {
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
  let mockProjetsService: jest.Mocked<GetProjetsService>;
  let mockDbService: jest.Mocked<DatabaseService>;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as CustomLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAtService = {
      fetchAides: jest.fn().mockResolvedValue([makeAide(1), makeAide(2)]),
      resolvePerimeterId: jest.fn().mockResolvedValue("87571"),
    } as unknown as jest.Mocked<AidesTerritoiresService>;

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      buildKey: jest.fn().mockReturnValue("perimeter=87571"),
      getPerimeterId: jest.fn().mockResolvedValue("87571"),
      setPerimeterId: jest.fn().mockResolvedValue(undefined),
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

    mockProjetsService = {
      findOne: jest.fn().mockResolvedValue({
        id: "test-id",
        collectivites: [{ type: "Commune", codeInsee: "44109" }],
        classificationScores: { thematiques: [], sites: [], interventions: [] },
      }),
    } as unknown as jest.Mocked<GetProjetsService>;

    const mockQueryResult = [{ nom: "Nantes" }];
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockQueryResult),
    };
    mockDbService = {
      database: mockQueryBuilder,
    } as unknown as jest.Mocked<DatabaseService>;

    controller = new AidesController(
      mockAtService,
      mockClassificationService,
      mockMatchingService,
      mockCacheService,
      mockWarmupService,
      mockDbService,
      mockProjetsService,
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

      await controller.listAides("test-id");

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

      await controller.listAides("test-id");

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
      await Promise.all([controller.listAides("test-id"), controller.listAides("test-id")]);

      await new Promise((r) => setTimeout(r, 100));

      // Only ONE background refresh should have been triggered
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(1);
    });

    it("should fetch synchronously on cache miss (cold start)", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAtService.fetchAides.mockResolvedValue([makeAide(1)]);

      await controller.listAides("test-id");

      expect(mockAtService.fetchAides).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe("syncClassifications", () => {
    it("should invalidate territories and trigger warmup", async () => {
      const result = await controller.syncClassifications();

      expect(mockCacheService.invalidateTerritories).toHaveBeenCalled();
      expect(mockWarmupService.warmup).toHaveBeenCalled();
      expect(result.warmup).toEqual({ territories: 3, duration: 5000 });
    });
  });
});
