/* eslint-disable @typescript-eslint/unbound-method */
import { AidesController } from "./aides.controller";
import { AidesTerritoiresService, AideTerritoires } from "./aides-territoires.service";
import { AideClassificationService } from "./aide-classification.service";
import { AidesMatchingService } from "./aides-matching.service";
import { AidesCacheService, CacheResult } from "./aides-cache.service";
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

      // Should NOT call AT API
      expect(mockAtService.fetchAides).not.toHaveBeenCalled();
      // Should NOT write to cache
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it("should serve stale data and trigger background refresh", async () => {
      const staleResult: CacheResult = {
        aides: [makeAide(1)],
        status: "stale",
      };
      mockCacheService.get.mockResolvedValue(staleResult);

      // Let the background refresh resolve
      mockAtService.fetchAides.mockResolvedValue([makeAide(1), makeAide(2)]);

      await controller.listAides("test-id");

      // Should return stale data (1 aide, not wait for refresh)
      // Background refresh should have been triggered (fire-and-forget)
      // We can't easily assert the background call happened synchronously,
      // but we can wait a tick and check
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAtService.fetchAides).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should fetch synchronously on cache miss (cold start)", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockAtService.fetchAides.mockResolvedValue([makeAide(1)]);

      await controller.listAides("test-id");

      // Should call AT API synchronously
      expect(mockAtService.fetchAides).toHaveBeenCalled();
      // Should store in cache
      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  describe("syncClassifications", () => {
    it("should call invalidateTerritories instead of invalidateAll", async () => {
      await controller.syncClassifications();

      expect(mockCacheService.invalidateTerritories).toHaveBeenCalled();
    });
  });
});
