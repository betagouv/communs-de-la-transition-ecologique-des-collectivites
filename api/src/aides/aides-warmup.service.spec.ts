/* eslint-disable @typescript-eslint/unbound-method */
import { AidesWarmupService } from "./aides-warmup.service";
import { CustomLogger } from "@logging/logger.service";
import { DatabaseService } from "@database/database.service";
import { AidesTerritoiresService, AideTerritoires } from "./aides-territoires.service";
import { AidesCacheService } from "./aides-cache.service";

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

describe("AidesWarmupService", () => {
  let service: AidesWarmupService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockAtService: jest.Mocked<AidesTerritoiresService>;
  let mockCacheService: jest.Mocked<AidesCacheService>;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as CustomLogger;

  const mockQueryBuilder = {
    selectDistinct: jest.fn(),
    from: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueryBuilder.selectDistinct.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.from.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.innerJoin.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockResolvedValue([]);

    mockDb = { database: mockQueryBuilder } as unknown as jest.Mocked<DatabaseService>;

    mockAtService = {
      fetchAides: jest.fn().mockResolvedValue([makeAide(1), makeAide(2)]),
    } as unknown as jest.Mocked<AidesTerritoiresService>;

    mockCacheService = {
      buildKey: jest.fn().mockImplementation((params: Record<string, string>) => {
        const sorted = Object.entries(params)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join("&");
        return sorted || "all";
      }),
      set: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AidesCacheService>;

    service = new AidesWarmupService(mockDb, mockAtService, mockCacheService, mockLogger);

    // Skip all delays in tests
    jest.spyOn(service as never, "delay" as never).mockResolvedValue(undefined as never);
  });

  describe("getActiveCodesInsee", () => {
    it("should return empty array when no projects have communes", async () => {
      mockQueryBuilder.where.mockResolvedValue([]);
      const result = await service.getActiveCodesInsee();
      expect(result).toEqual([]);
    });

    it("should return distinct commune codes", async () => {
      mockQueryBuilder.where.mockResolvedValue([
        { codeInsee: "44109", nom: "Nantes" },
        { codeInsee: "69123", nom: "Lyon" },
      ]);
      const result = await service.getActiveCodesInsee();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ codeInsee: "44109", nom: "Nantes" });
    });

    it("should filter out null codeInsee values", async () => {
      mockQueryBuilder.where.mockResolvedValue([
        { codeInsee: "44109", nom: "Nantes" },
        { codeInsee: null, nom: "Unknown" },
      ]);
      const result = await service.getActiveCodesInsee();
      expect(result).toHaveLength(1);
    });
  });

  describe("warmup", () => {
    it("should return immediately when no active territories", async () => {
      mockQueryBuilder.where.mockResolvedValue([]);
      const result = await service.warmup();
      expect(result.territories).toBe(0);
      expect(mockAtService.fetchAides).not.toHaveBeenCalled();
    });

    it("should warm all active territories sequentially", async () => {
      mockQueryBuilder.where.mockResolvedValue([
        { codeInsee: "44109", nom: "Nantes" },
        { codeInsee: "69123", nom: "Lyon" },
      ]);

      const result = await service.warmup();

      expect(result.territories).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(2);
      expect(mockCacheService.set).toHaveBeenCalledTimes(2);
    });

    it("should pass perimeter_codes[] with code INSEE directly to AT", async () => {
      mockQueryBuilder.where.mockResolvedValue([{ codeInsee: "44109", nom: "Nantes" }]);

      await service.warmup();

      expect(mockAtService.fetchAides).toHaveBeenCalledWith({ "perimeter_codes[]": "44109" });
    });

    it("should continue on individual territory failure", async () => {
      mockQueryBuilder.where.mockResolvedValue([
        { codeInsee: "44109", nom: "Nantes" },
        { codeInsee: "69123", nom: "Lyon" },
        { codeInsee: "35238", nom: "Rennes" },
      ]);

      mockAtService.fetchAides
        .mockResolvedValueOnce([makeAide(1)])
        .mockRejectedValueOnce(new Error("AT API timeout"))
        .mockResolvedValueOnce([makeAide(2)]);

      const result = await service.warmup();

      expect(result.territories).toBe(2);
      expect(result.failed).toBe(1);
    });

    it("should retry on 429 errors with exponential backoff", async () => {
      mockQueryBuilder.where.mockResolvedValue([{ codeInsee: "44109", nom: "Nantes" }]);

      mockAtService.fetchAides
        .mockRejectedValueOnce(new Error("AT API error: 429 Too Many Requests"))
        .mockRejectedValueOnce(new Error("AT API error: 429 Too Many Requests"))
        .mockResolvedValueOnce([makeAide(1)]);

      const result = await service.warmup();

      expect(result.territories).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it("should give up after max retries on persistent 429", async () => {
      mockQueryBuilder.where.mockResolvedValue([{ codeInsee: "44109", nom: "Nantes" }]);

      mockAtService.fetchAides.mockRejectedValue(new Error("AT API error: 429 Too Many Requests"));

      const result = await service.warmup();

      expect(result.territories).toBe(0);
      expect(result.failed).toBe(1);
      // 1 initial + 3 retries = 4 calls
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(4);
    });

    it("should process territories sequentially (no concurrency)", async () => {
      const communes = Array.from({ length: 5 }, (_, i) => ({
        codeInsee: String(10000 + i),
        nom: `Commune ${i}`,
      }));
      mockQueryBuilder.where.mockResolvedValue(communes);

      let maxConcurrent = 0;
      let currentConcurrent = 0;

      mockAtService.fetchAides.mockImplementation(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await Promise.resolve();
        currentConcurrent--;
        return [makeAide(1)];
      });

      await service.warmup();

      expect(maxConcurrent).toBe(1);
      expect(mockAtService.fetchAides).toHaveBeenCalledTimes(5);
    });
  });
});
