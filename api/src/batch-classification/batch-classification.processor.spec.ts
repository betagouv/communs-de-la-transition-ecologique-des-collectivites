/* eslint-disable @typescript-eslint/unbound-method */
import { BatchClassificationProcessor } from "./batch-classification.processor";
import { CustomLogger } from "@logging/logger.service";
import { DatabaseService } from "@database/database.service";
import { ClassificationAnthropicService } from "@/projet-qualification/classification/llm/classification-anthropic.service";
import { ClassificationValidationService } from "@/projet-qualification/classification/validation/classification-validation.service";
import { EnrichmentService } from "@/projet-qualification/classification/post-processing/enrichment.service";
import { TEProbabilityService } from "@/projet-qualification/classification/post-processing/te-probability.service";
import { Job, Queue } from "bullmq";
import { BATCH_POLL_JOB, BATCH_PROCESS_JOB } from "./batch-classification.const";

// Mock Sentry
jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

function makeJob<T>(name: string, data: T, attemptsMade = 0): Job<T> {
  return { name, data, attemptsMade } as unknown as Job<T>;
}

describe("BatchClassificationProcessor", () => {
  let processor: BatchClassificationProcessor;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockAnthropicService: jest.Mocked<ClassificationAnthropicService>;
  let mockValidationService: jest.Mocked<ClassificationValidationService>;
  let mockEnrichmentService: jest.Mocked<EnrichmentService>;
  let mockTeProbabilityService: jest.Mocked<TEProbabilityService>;
  let mockQueue: jest.Mocked<Queue>;

  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as CustomLogger;

  const mockBatchCreate = jest.fn();
  const mockBatchRetrieve = jest.fn();
  const mockBatchResults = jest.fn();

  const mockClient = {
    messages: {
      batches: {
        create: mockBatchCreate,
        retrieve: mockBatchRetrieve,
        results: mockBatchResults,
      },
    },
  };

  // Mock paginated query builder
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: return empty array (no unclassified projects)
    mockQueryBuilder.offset.mockResolvedValue([]);

    mockDb = {
      database: {
        ...mockQueryBuilder,
        select: jest.fn().mockReturnValue(mockQueryBuilder),
        update: jest
          .fn()
          .mockReturnValue({ set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) }),
      },
    } as unknown as jest.Mocked<DatabaseService>;

    mockAnthropicService = {
      getClient: jest.fn().mockReturnValue(mockClient),
      buildMessageParams: jest.fn().mockReturnValue({ model: "claude-sonnet-4-6", messages: [] }),
      parseResponse: jest.fn().mockReturnValue({
        json: { projet: "test", items: [{ label: "Energies renouvelables", score: 0.9 }] },
      }),
    } as unknown as jest.Mocked<ClassificationAnthropicService>;

    mockValidationService = {
      validateAndCorrect: jest.fn().mockReturnValue({ "Energies renouvelables": 0.9 }),
    } as unknown as jest.Mocked<ClassificationValidationService>;

    mockEnrichmentService = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      enrich: jest.fn().mockImplementation((input) => input),
    } as unknown as jest.Mocked<EnrichmentService>;

    mockTeProbabilityService = {
      calculate: jest.fn().mockReturnValue(0.8),
    } as unknown as jest.Mocked<TEProbabilityService>;

    mockQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Queue>;

    processor = new BatchClassificationProcessor(
      mockDb,
      mockAnthropicService,
      mockValidationService,
      mockEnrichmentService,
      mockTeProbabilityService,
      mockQueue,
      mockLogger,
    );
  });

  describe("handleSubmit (via process)", () => {
    it("should skip when no unclassified projects", async () => {
      const job = makeJob("submit", { triggeredBy: "test" });

      const result = await processor.process(job);

      expect(result).toEqual({ submitted: 0 });
      expect(mockBatchCreate).not.toHaveBeenCalled();
    });

    it("should submit batch and enqueue poll job", async () => {
      // Return 2 projects on first page, empty on second (end of pagination)
      mockQueryBuilder.offset
        .mockResolvedValueOnce([
          { id: "proj-1", nom: "Projet 1", description: "Desc 1" },
          { id: "proj-2", nom: "Projet 2", description: "Desc 2" },
        ])
        .mockResolvedValueOnce([]);

      mockBatchCreate.mockResolvedValue({ id: "batch_abc", processing_status: "in_progress" });

      const job = makeJob("submit", { triggeredBy: "test", projectCount: 2 });
      const result = await processor.process(job);

      expect(mockBatchCreate).toHaveBeenCalledTimes(1);
      expect(mockAnthropicService.buildMessageParams).toHaveBeenCalledTimes(6); // 2 projects × 3 axes
      expect(mockQueue.add).toHaveBeenCalledWith(
        BATCH_POLL_JOB,
        expect.objectContaining({ batchIds: ["batch_abc"], totalProjects: 2 }),
        expect.any(Object),
      );
      expect(result).toEqual(expect.objectContaining({ totalProjects: 2 }));
    });
  });

  describe("handlePoll (via process)", () => {
    it("should throw when batches are not complete (triggers BullMQ retry)", async () => {
      mockBatchRetrieve.mockResolvedValue({ processing_status: "in_progress" });

      const job = makeJob("poll", { batchIds: ["batch_abc"], totalProjects: 10 });

      await expect(processor.process(job)).rejects.toThrow("Batches not yet complete");
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should enqueue process jobs when all batches ended", async () => {
      mockBatchRetrieve.mockResolvedValue({ processing_status: "ended" });

      const job = makeJob("poll", { batchIds: ["batch_abc", "batch_def"], totalProjects: 10 });
      const result = await processor.process(job);

      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(BATCH_PROCESS_JOB, { batchId: "batch_abc" });
      expect(mockQueue.add).toHaveBeenCalledWith(BATCH_PROCESS_JOB, { batchId: "batch_def" });
      expect(result).toEqual(expect.objectContaining({ status: "ended" }));
    });
  });

  describe("handleProcess (via process)", () => {
    it("should skip incomplete projects (< 3 axes)", async () => {
      // Only 2 axes for proj-1 (missing interventions)
      const asyncResults = (function* () {
        yield {
          custom_id: "proj-1--thematiques",
          result: {
            type: "succeeded" as const,
            message: { content: [{ type: "text" as const, text: '{"projet":"p","items":[]}' }] },
          },
        };
        yield {
          custom_id: "proj-1--sites",
          result: {
            type: "succeeded" as const,
            message: { content: [{ type: "text" as const, text: '{"projet":"p","items":[]}' }] },
          },
        };
      })();
      mockBatchResults.mockResolvedValue(asyncResults);

      const job = makeJob("process", { batchId: "batch_abc" });
      const result = await processor.process(job);

      expect(result).toEqual(expect.objectContaining({ classified: 0 }));
    });

    it("should process complete projects (3 axes) and write to DB", async () => {
      const asyncResults = (function* () {
        for (const axis of ["thematiques", "sites", "interventions"]) {
          yield {
            custom_id: `proj-1--${axis}`,
            result: {
              type: "succeeded" as const,
              message: {
                content: [{ type: "text" as const, text: '{"projet":"p","items":[{"label":"Test","score":0.9}]}' }],
              },
            },
          };
        }
      })();
      mockBatchResults.mockResolvedValue(asyncResults);

      // Mock the chained update().set().where()
      const mockWhere = jest.fn().mockResolvedValue([]);
      const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
      (mockDb.database as unknown as { update: jest.Mock }).update = jest.fn().mockReturnValue({ set: mockSet });

      const job = makeJob("process", { batchId: "batch_abc" });
      const result = await processor.process(job);

      expect(result).toEqual(expect.objectContaining({ classified: 1 }));
      expect(mockValidationService.validateAndCorrect).toHaveBeenCalledTimes(3);
      expect(mockEnrichmentService.enrich).toHaveBeenCalledTimes(1);
      expect(mockTeProbabilityService.calculate).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledTimes(1); // 1 project written
    });
  });
});
