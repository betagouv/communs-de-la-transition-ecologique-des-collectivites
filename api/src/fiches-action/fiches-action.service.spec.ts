import { FichesActionService } from "./fiches-action.service";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { Queue } from "bullmq";
import { CreateFicheActionRequest } from "./dto/create-fiche-action.dto";

describe("FichesActionService", () => {
  let service: FichesActionService;

  beforeEach(() => {
    const mockLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as CustomLogger;
    const mockQueue = {} as unknown as Queue;
    const mockDbService = {} as unknown as DatabaseService;
    service = new FichesActionService(mockDbService, mockQueue, mockLogger);
  });

  describe("buildSourceMetadata", () => {
    it("should collect non-v0.2 fields into metadata", () => {
      const dto = {
        nom: "Test",
        externalId: "1",
        collectivites: [],
        budgetPrevisionnel: 500000,
        phase: "Opération",
        phaseStatut: "En cours",
        porteur: { referentNom: "Dupont", referentEmail: "d@m.fr" },
      } as CreateFicheActionRequest;

      const metadata = service.buildSourceMetadata(dto);
      expect(metadata.budgetPrevisionnel).toBe(500000);
      expect(metadata.phase).toBe("Opération");
      expect(metadata.phaseStatut).toBe("En cours");
      expect(metadata.porteur).toEqual({ referentNom: "Dupont", referentEmail: "d@m.fr" });
    });

    it("should return empty object when no extra fields", () => {
      const dto = {
        nom: "Test",
        externalId: "1",
        collectivites: [],
      } as CreateFicheActionRequest;

      const metadata = service.buildSourceMetadata(dto);
      expect(Object.keys(metadata)).toHaveLength(0);
    });

    it("should skip null/undefined values", () => {
      const dto = {
        nom: "Test",
        externalId: "1",
        collectivites: [],
        budgetPrevisionnel: null,
        phase: undefined,
      } as CreateFicheActionRequest;

      const metadata = service.buildSourceMetadata(dto);
      expect(metadata.budgetPrevisionnel).toBeUndefined();
      expect(metadata.phase).toBeUndefined();
    });

    it("should include dateDebutPrevisionnelle", () => {
      const dto = {
        nom: "Test",
        externalId: "1",
        collectivites: [],
        dateDebutPrevisionnelle: "2026-01-01",
      } as CreateFicheActionRequest;

      const metadata = service.buildSourceMetadata(dto);
      expect(metadata.dateDebutPrevisionnelle).toBe("2026-01-01");
    });
  });
});
