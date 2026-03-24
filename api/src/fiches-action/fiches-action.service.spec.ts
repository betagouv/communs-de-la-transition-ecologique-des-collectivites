/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access */
import { FichesActionService } from "./fiches-action.service";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { Queue } from "bullmq";
import { PROJECT_QUALIFICATION_CLASSIFICATION_JOB } from "@/projet-qualification/const";
import { CreateFicheActionRequest } from "./dto/create-fiche-action.dto";

describe("FichesActionService", () => {
  let service: FichesActionService;
  let mockQueue: jest.Mocked<Queue>;
  let mockLogger: jest.Mocked<CustomLogger>;

  const mockReturning = jest.fn();
  const mockOnConflictDoNothing = jest.fn().mockResolvedValue(undefined);
  const mockValues = jest.fn().mockReturnValue({
    returning: mockReturning,
    onConflictDoNothing: mockOnConflictDoNothing,
  });
  const mockWhere = jest.fn().mockResolvedValue(undefined);
  const mockLimit = jest.fn().mockResolvedValue([]);
  const mockSelectFrom = jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit: mockLimit }) });
  const mockUpdate = jest.fn().mockReturnValue({ set: jest.fn().mockReturnValue({ where: mockWhere }) });

  beforeEach(() => {
    mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as jest.Mocked<CustomLogger>;
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<Queue>;

    const mockDb = {
      insert: jest.fn().mockReturnValue({ values: mockValues }),
      delete: jest.fn().mockReturnValue({ where: mockWhere }),
      select: jest.fn().mockReturnValue({ from: mockSelectFrom }),
      update: mockUpdate,
    };

    const mockDbService = { database: mockDb } as unknown as DatabaseService;
    service = new FichesActionService(mockDbService, mockQueue, mockLogger);

    jest.clearAllMocks();
    mockValues.mockReturnValue({
      returning: mockReturning,
      onConflictDoNothing: mockOnConflictDoNothing,
    });
    mockSelectFrom.mockReturnValue({ where: jest.fn().mockReturnValue({ limit: mockLimit }) });
  });

  describe("createOrUpdate", () => {
    const baseFiche: CreateFicheActionRequest = {
      nom: "Rénovation thermique des écoles",
      externalId: "12345",
      description: "Isolation et changement de chauffage",
      collectivites: [{ type: "EPCI", code: "244400404" }],
    };

    it("should create a new fiche action and schedule classification", async () => {
      // No existing external ID
      mockLimit.mockResolvedValueOnce([]);
      // Insert fiche
      mockReturning.mockResolvedValueOnce([{ id: "uuid-fiche-1" }]);
      // Check classification (null)
      mockLimit.mockResolvedValueOnce([{ classificationThematiques: null }]);

      const result = await service.createOrUpdate(baseFiche);

      expect(result.id).toBe("uuid-fiche-1");
      expect(mockQueue.add).toHaveBeenCalledWith(
        PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
        { ficheActionId: "uuid-fiche-1" },
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it("should not schedule classification if already classified", async () => {
      // No existing external ID
      mockLimit.mockResolvedValueOnce([]);
      // Insert fiche
      mockReturning.mockResolvedValueOnce([{ id: "uuid-fiche-1" }]);
      // Check classification (already has values)
      mockLimit.mockResolvedValueOnce([{ classificationThematiques: ["Isolation thermique"] }]);

      await service.createOrUpdate(baseFiche);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it("should accept porteur field without storing it (RGPD)", async () => {
      mockLimit.mockResolvedValueOnce([]);
      mockReturning.mockResolvedValueOnce([{ id: "uuid-fiche-2" }]);
      mockLimit.mockResolvedValueOnce([{ classificationThematiques: null }]);

      const ficheWithPorteur = {
        ...baseFiche,
        porteur: { referentNom: "Dupont", referentEmail: "dupont@mairie.fr" },
      };

      // Should not throw
      const result = await service.createOrUpdate(ficheWithPorteur);
      expect(result.id).toBe("uuid-fiche-2");
    });
  });
});
