import { AidesCacheService } from "./aides-cache.service";
import { ConfigService } from "@nestjs/config";
import { CustomLogger } from "@logging/logger.service";
import { AideTerritoires } from "./aides-territoires.service";

// Mock ioredis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  mget: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  disconnect: jest.fn(),
  pipeline: jest.fn(),
};

const mockPipeline = {
  set: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

function makeAide(id: number, name = `Aide ${id}`): AideTerritoires {
  return {
    id,
    slug: `aide-${id}`,
    url: `/aides/${id}/`,
    name,
    name_initial: name,
    short_title: null,
    financers: [],
    financers_full: [],
    instructors: [],
    programs: [],
    description: `Description of aide ${id}`,
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

describe("AidesCacheService", () => {
  let service: AidesCacheService;
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as CustomLogger;

  const mockConfig = {
    getOrThrow: jest.fn().mockReturnValue("redis://localhost:6379"),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
    service = new AidesCacheService(mockConfig, mockLogger);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  describe("buildKey", () => {
    it("should sort parameters alphabetically", () => {
      expect(service.buildKey({ z: "1", a: "2" })).toBe("a=2&z=1");
    });

    it("should return 'all' for empty params", () => {
      expect(service.buildKey({})).toBe("all");
    });
  });

  describe("set (deduplicated write)", () => {
    it("should store individual aides via pipeline + territory index", async () => {
      const aides = [makeAide(1), makeAide(2), makeAide(3)];

      await service.set("perimeter=12345", aides);

      // Individual aides stored via pipeline
      expect(mockPipeline.set).toHaveBeenCalledTimes(3);
      expect(mockPipeline.set).toHaveBeenCalledWith(
        "at:aide:1",
        JSON.stringify(aides[0]),
        "EX",
        604800, // 7 days
      );
      expect(mockPipeline.exec).toHaveBeenCalled();

      // Territory index stored with IDs + timestamp
      expect(mockRedis.set).toHaveBeenCalledWith(
        "at:territory:perimeter=12345",
        expect.stringContaining('"ids":[1,2,3]'),
        "EX",
        604800, // 7 days stale max
      );
    });

    it("should not write anything for empty aides array", async () => {
      await service.set("perimeter=12345", []);

      expect(mockPipeline.set).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe("get (SWR read)", () => {
    it("should return null on cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get("perimeter=12345");

      expect(result).toBeNull();
    });

    it("should return fresh status when entry is recent", async () => {
      const aides = [makeAide(1), makeAide(2)];
      const entry = { ids: [1, 2], storedAt: Date.now() - 30 * 60 * 1000 }; // 30 min ago

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      mockRedis.mget.mockResolvedValue([JSON.stringify(aides[0]), JSON.stringify(aides[1])]);

      const result = await service.get("perimeter=12345");

      expect(result).not.toBeNull();
      expect(result!.status).toBe("fresh");
      expect(result!.aides).toHaveLength(2);
      expect(result!.aides[0].id).toBe(1);
    });

    it("should return stale status when entry is older than 1h", async () => {
      const entry = { ids: [1], storedAt: Date.now() - 2 * 3600 * 1000 }; // 2h ago

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      mockRedis.mget.mockResolvedValue([JSON.stringify(makeAide(1))]);

      const result = await service.get("perimeter=12345");

      expect(result).not.toBeNull();
      expect(result!.status).toBe("stale");
    });

    it("should handle expired individual aide keys gracefully", async () => {
      const entry = { ids: [1, 2, 3], storedAt: Date.now() }; // fresh

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));
      // Aide 2 has expired (null from MGET)
      mockRedis.mget.mockResolvedValue([JSON.stringify(makeAide(1)), null, JSON.stringify(makeAide(3))]);

      const result = await service.get("perimeter=12345");

      expect(result!.aides).toHaveLength(2);
      expect(result!.aides.map((a) => a.id)).toEqual([1, 3]);
    });
  });

  describe("invalidateTerritories", () => {
    it("should delete all territory index keys using SCAN", async () => {
      // First scan returns keys + cursor, second scan returns empty + cursor "0"
      mockRedis.scan
        .mockResolvedValueOnce(["42", ["at:territory:a=1", "at:territory:b=2"]])
        .mockResolvedValueOnce(["0", []]);

      await service.invalidateTerritories();

      expect(mockRedis.scan).toHaveBeenCalledWith("0", "MATCH", "at:territory:*", "COUNT", 100);
      expect(mockRedis.del).toHaveBeenCalledWith("at:territory:a=1", "at:territory:b=2");
    });

    it("should handle multiple scan pages", async () => {
      mockRedis.scan
        .mockResolvedValueOnce(["5", ["at:territory:a=1"]])
        .mockResolvedValueOnce(["0", ["at:territory:b=2"]]);

      await service.invalidateTerritories();

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it("should not call del when no keys exist", async () => {
      mockRedis.scan.mockResolvedValue(["0", []]);

      await service.invalidateTerritories();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("invalidateAll (backward compat)", () => {
    it("should delegate to invalidateTerritories", async () => {
      mockRedis.scan.mockResolvedValue(["0", []]);

      await service.invalidateAll();

      expect(mockRedis.scan).toHaveBeenCalledWith("0", "MATCH", "at:territory:*", "COUNT", 100);
    });
  });
});
