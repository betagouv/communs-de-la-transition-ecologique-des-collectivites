import { BadRequestException } from "@nestjs/common";
import { DecisionsService } from "./decisions.service";
import { DatabaseService } from "@database/database.service";
import { CreateDecisionDto } from "./dto/create-decision.dto";

describe("DecisionsService", () => {
  let service: DecisionsService;
  let insertedValues: Record<string, unknown> | undefined;
  let whereArg: unknown;

  const createdAt = new Date("2026-07-07T10:00:00.000Z");

  // Chaîne Drizzle : insert().values().returning() ; select().from().where().limit()
  // (lookup supersedes) ET select().from().where().orderBy().limit() (find).
  const makeDb = (opts: { returning?: unknown[]; selectRows?: unknown[] }) => {
    const returning = jest.fn().mockResolvedValue(opts.returning ?? []);
    const values = jest.fn().mockImplementation((v: Record<string, unknown>) => {
      insertedValues = v;
      return { returning };
    });
    const insert = jest.fn().mockReturnValue({ values });

    const limit = jest.fn().mockResolvedValue(opts.selectRows ?? []);
    const orderBy = jest.fn().mockReturnValue({ limit });
    const where = jest.fn().mockImplementation((w: unknown) => {
      whereArg = w;
      return { orderBy, limit };
    });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });

    return { insert, select } as unknown as DatabaseService["database"];
  };

  const buildService = (opts: { returning?: unknown[]; selectRows?: unknown[] }) => {
    const dbService = { database: makeDb(opts) } as unknown as DatabaseService;
    return new DecisionsService(dbService);
  };

  beforeEach(() => {
    insertedValues = undefined;
    whereArg = undefined;
  });

  describe("create", () => {
    // rattachement_pcaet : porte à la fois objetB (pcaet + SIREN) et verdict → couvre
    // la persistance de tous les champs binaires.
    const dto: CreateDecisionDto = {
      typeDecision: "rattachement_pcaet",
      objetAType: "projet",
      objetAId: "proj-a",
      objetBType: "pcaet",
      objetBId: "200000172",
      verdict: "confirme",
    };

    it("dérive plateformeSource de l'argument (jamais du DTO) et renvoie id + createdAt ISO", async () => {
      service = buildService({ returning: [{ id: "dec-1", createdAt }] });

      const result = await service.create(dto, "MEC");

      expect(result).toEqual({ id: "dec-1", createdAt: "2026-07-07T10:00:00.000Z" });
      expect(insertedValues).toMatchObject({
        typeDecision: "rattachement_pcaet",
        objetAType: "projet",
        objetAId: "proj-a",
        objetBType: "pcaet",
        objetBId: "200000172",
        verdict: "confirme",
        plateformeSource: "MEC",
      });
    });

    it("valide le contrat AVANT d'insérer : 400 et aucune insertion si le type est violé", async () => {
      service = buildService({ returning: [{ id: "dec-x", createdAt }] });

      // doublon_confirme sans objetB → interdit par le contrat.
      await expect(
        service.create({ typeDecision: "doublon_confirme", objetAType: "projet", objetAId: "proj-a" }, "MEC"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(insertedValues).toBeUndefined();
    });

    it("persiste supersedes quand la cible est compatible (même plateforme + même type)", async () => {
      service = buildService({
        returning: [{ id: "dec-3", createdAt }],
        // Décision cible chargée par assertSupersedesCompatible.
        selectRows: [{ plateformeSource: "MEC", typeDecision: "rattachement_pcaet" }],
      });

      await service.create({ ...dto, supersedes: "dec-1" }, "MEC");

      expect(insertedValues).toMatchObject({ supersedes: "dec-1" });
    });

    it("400 si supersedes vise une décision d'une AUTRE plateforme (aucune insertion)", async () => {
      service = buildService({
        returning: [{ id: "dec-x", createdAt }],
        selectRows: [{ plateformeSource: "TeT", typeDecision: "rattachement_pcaet" }],
      });

      await expect(service.create({ ...dto, supersedes: "dec-1" }, "MEC")).rejects.toBeInstanceOf(BadRequestException);
      expect(insertedValues).toBeUndefined();
    });

    it("400 si supersedes vise une décision d'un AUTRE type (aucune insertion)", async () => {
      service = buildService({
        returning: [{ id: "dec-x", createdAt }],
        selectRows: [{ plateformeSource: "MEC", typeDecision: "doublon_infirme" }],
      });

      await expect(service.create({ ...dto, supersedes: "dec-1" }, "MEC")).rejects.toBeInstanceOf(BadRequestException);
      expect(insertedValues).toBeUndefined();
    });

    it("400 si la décision cible de supersedes est introuvable (aucune insertion)", async () => {
      service = buildService({ returning: [{ id: "dec-x", createdAt }], selectRows: [] });

      await expect(service.create({ ...dto, supersedes: "dec-1" }, "MEC")).rejects.toBeInstanceOf(BadRequestException);
      expect(insertedValues).toBeUndefined();
    });

    it("persiste une révocation verdict='annule' quand la cible est compatible", async () => {
      service = buildService({
        returning: [{ id: "dec-9", createdAt }],
        selectRows: [{ plateformeSource: "MEC", typeDecision: "doublon_confirme" }],
      });

      await service.create(
        {
          typeDecision: "doublon_confirme",
          objetAType: "projet",
          objetAId: "a",
          objetBType: "projet",
          objetBId: "b",
          verdict: "annule",
          supersedes: "dec-1",
        },
        "MEC",
      );

      expect(insertedValues).toMatchObject({ verdict: "annule", supersedes: "dec-1" });
    });

    it("normalise les champs optionnels absents en null (dont supersedes)", async () => {
      service = buildService({ returning: [{ id: "dec-2", createdAt }] });

      await service.create(
        { typeDecision: "projet_statut", objetAType: "projet", objetAId: "proj-a", verdict: "valide" },
        "TeT",
      );

      expect(insertedValues).toMatchObject({
        objetBType: null,
        objetBId: null,
        auteur: null,
        commentaire: null,
        payload: null,
        supersedes: null,
        plateformeSource: "TeT",
      });
    });
  });

  describe("find", () => {
    it("renvoie les décisions trouvées sous forme { items } et applique un filtre WHERE (cloisonnement)", async () => {
      const rows = [{ id: "dec-1" }, { id: "dec-2" }];
      service = buildService({ selectRows: rows });

      const result = await service.find({ objetId: "proj-a" }, "MEC");

      expect(result).toEqual({ items: rows });
      // Le cloisonnement par plateforme est appliqué dans la clause WHERE.
      expect(whereArg).toBeDefined();
    });

    it("accepte un filtre par type seul (sans objetId)", async () => {
      service = buildService({ selectRows: [] });

      const result = await service.find({ type: "projet_statut" }, "TeT");

      expect(result).toEqual({ items: [] });
      expect(whereArg).toBeDefined();
    });
  });
});
