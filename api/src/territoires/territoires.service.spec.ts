import { NotFoundException } from "@nestjs/common";
import { TerritoiresService } from "./territoires.service";
import { DatabaseService } from "@database/database.service";

describe("TerritoiresService", () => {
  let execute: jest.Mock;
  let selectLimit: jest.Mock;
  let service: TerritoiresService;

  // execute() sert les requêtes SQL brutes ; select().from().where().limit() la résolution external_id.
  const makeDb = () => {
    execute = jest.fn();
    selectLimit = jest.fn();
    const where = jest.fn().mockReturnValue({ limit: selectLimit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    return { execute, select } as unknown as DatabaseService["database"];
  };

  beforeEach(() => {
    const dbService = { database: makeDb() } as unknown as DatabaseService;
    service = new TerritoiresService(dbService);
  });

  describe("territoireProjets", () => {
    const params = { limit: 50, offset: 0, inclureFinancementsSeuls: false };

    it("renvoie la forme { total, limit, offset, groupes } pour une commune (INSEE 5 chiffres)", async () => {
      execute.mockResolvedValueOnce({
        rows: [
          {
            confiance: "CERTAIN",
            traces: [{ role: "projet", source: "MEC", id: "p1" }],
            total: "1",
          },
        ],
      });

      const result = await service.territoireProjets("01001", params);

      expect(result).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
        groupes: [{ confiance: "CERTAIN", traces: [{ role: "projet", source: "MEC", id: "p1" }] }],
      });
      // Une commune INSEE ne déclenche pas de résolution de périmètre : une seule requête SQL.
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("total = 0 et groupes = [] quand aucun groupe", async () => {
      execute.mockResolvedValueOnce({ rows: [] });
      const result = await service.territoireProjets("01001", params);
      expect(result).toEqual({ total: 0, limit: 50, offset: 0, groupes: [] });
    });

    it("résout un EPCI (SIREN 9 chiffres) en ses communes, 404 si aucune", async () => {
      execute.mockResolvedValueOnce({ rows: [] }); // périmètre vide
      await expect(service.territoireProjets("200000172", params)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404 pour un code de format invalide", async () => {
      await expect(service.territoireProjets("abc", params)).rejects.toBeInstanceOf(NotFoundException);
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe("qualification", () => {
    it("404 quand l'external_id est inconnu", async () => {
      selectLimit.mockResolvedValueOnce([]);
      await expect(service.qualification("mec-unknown")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("découpe les leviers, normalise proba et date pour un external_id connu", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute.mockResolvedValueOnce({
        rows: [
          {
            leviersSgpe: "Vélo,Covoiturage",
            llmThematiques: [{ label: "Mobilité", score: 0.9 }],
            llmProbabiliteTe: 0.87,
            llmClassifiedAt: new Date("2026-07-01T08:00:00.000Z"),
          },
        ],
      });

      const result = await service.qualification("mec-123");

      expect(result).toEqual({
        externalId: "mec-123",
        projetId: "proj-uuid",
        leviersSgpe: ["Vélo", "Covoiturage"],
        llmThematiques: [{ label: "Mobilité", score: 0.9 }],
        llmProbabiliteTe: 0.87,
        llmClassifiedAt: "2026-07-01T08:00:00.000Z",
      });
    });
  });

  describe("planFichesTerritoire", () => {
    it("404 quand l'external_id est inconnu", async () => {
      selectLimit.mockResolvedValueOnce([]);
      await expect(service.planFichesTerritoire("mec-unknown")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("renvoie pcaet vide sans communes rattachées", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute.mockResolvedValueOnce({ rows: [] }); // communes du projet
      const result = await service.planFichesTerritoire("mec-123");
      expect(result).toEqual({ pcaet: [], fichesActionSuggerees: [] });
    });

    it("mappe les PCAET couvrant les communes du projet", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute
        .mockResolvedValueOnce({ rows: [{ insee: "01001" }] }) // communes du projet
        .mockResolvedValueOnce({
          rows: [
            {
              nom: "PCAET Test",
              sirenPorteur: "200000172",
              presentDansTet: true,
              tetExternalId: "tet-9",
              source: "live",
            },
          ],
        });

      const result = await service.planFichesTerritoire("mec-123");

      expect(result).toEqual({
        pcaet: [
          {
            nom: "PCAET Test",
            sirenPorteur: "200000172",
            presentDansTet: true,
            tetExternalId: "tet-9",
            source: "live",
          },
        ],
        fichesActionSuggerees: [],
      });
    });
  });
});
