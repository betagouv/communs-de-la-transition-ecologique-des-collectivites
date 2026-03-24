/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import { FichesActionService } from "./fiches-action.service";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { Queue } from "bullmq";
import { PROJECT_QUALIFICATION_CLASSIFICATION_JOB } from "@/projet-qualification/const";
import { CreateFicheActionRequest } from "./dto/create-fiche-action.dto";

describe("FichesActionService", () => {
  let service: FichesActionService;
  let mockDb: {
    insert: jest.Mock;
    delete: jest.Mock;
  };
  let mockQueue: jest.Mocked<Queue>;
  let mockLogger: jest.Mocked<CustomLogger>;

  const mockReturning = jest.fn();
  const mockOnConflictDoUpdate = jest.fn().mockReturnValue({ returning: mockReturning });
  const mockOnConflictDoNothing = jest.fn().mockResolvedValue(undefined);
  const mockValues = jest.fn().mockReturnValue({
    onConflictDoUpdate: mockOnConflictDoUpdate,
    onConflictDoNothing: mockOnConflictDoNothing,
  });
  const mockWhere = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as jest.Mocked<CustomLogger>;
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<Queue>;

    mockDb = {
      insert: jest.fn().mockReturnValue({ values: mockValues }),
      delete: jest.fn().mockReturnValue({ where: mockWhere }),
    };

    const mockDbService = {
      database: mockDb,
    } as unknown as DatabaseService;

    service = new FichesActionService(mockDbService, mockQueue, mockLogger);

    jest.clearAllMocks();
    mockValues.mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: mockOnConflictDoNothing,
    });
  });

  describe("createOrUpdate", () => {
    const baseFiche: CreateFicheActionRequest = {
      nom: "Rénovation thermique des écoles",
      externalId: "12345",
      description: "Isolation et changement de chauffage",
      collectivites: [{ type: "EPCI", code: "244400404" }],
    };

    it("should upsert a fiche action and schedule classification", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "uuid-fiche-1",
          tetId: "12345",
          nom: "Rénovation thermique des écoles",
          classificationThematiques: null,
        },
      ]);

      const result = await service.createOrUpdate(baseFiche);

      expect(result.id).toBe("uuid-fiche-1");
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
        { ficheActionId: "uuid-fiche-1" },
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it("should not schedule classification if already classified", async () => {
      mockReturning.mockResolvedValueOnce([
        {
          id: "uuid-fiche-1",
          tetId: "12345",
          classificationThematiques: ["Isolation thermique"],
        },
      ]);

      await service.createOrUpdate(baseFiche);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should upsert plans when provided", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "uuid-fiche-1", tetId: "12345", classificationThematiques: ["X"] }])
        .mockResolvedValueOnce([{ id: "uuid-plan-1", tetId: "5" }]);

      const ficheWithPlans = {
        ...baseFiche,
        plans: [{ id: "5", nom: "PCAET Nantes", type: "PCAET" }],
      };

      await service.createOrUpdate(ficheWithPlans);

      // Should have called insert for the plan
      expect(mockDb.insert).toHaveBeenCalledTimes(3); // fiche + plan + link
    });

    it("should store parentId for sous-actions", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "uuid-fiche-2", tetId: "12346", classificationThematiques: null }]);

      const sousAction = {
        ...baseFiche,
        externalId: "12346",
        parentId: "12345",
      };

      await service.createOrUpdate(sousAction);

      // Verify the insert was called with parentTetId
      const insertCall = mockValues.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.parentTetId).toBe("12345");
    });

    it("should use phaseStatut as fallback for statut", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "uuid-fiche-3", tetId: "12347", classificationThematiques: null }]);

      const ficheWithPhaseStatut = {
        ...baseFiche,
        externalId: "12347",
        phaseStatut: "En cours",
      };

      await service.createOrUpdate(ficheWithPhaseStatut);

      const insertCall = mockValues.mock.calls[0][0] as Record<string, unknown>;
      expect(insertCall.statut).toBe("En cours");
    });
  });
});
