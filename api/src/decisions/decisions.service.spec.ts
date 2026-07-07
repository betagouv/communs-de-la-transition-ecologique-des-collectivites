import { DecisionsService } from "./decisions.service";
import { DatabaseService } from "@database/database.service";
import { CreateDecisionDto } from "./dto/create-decision.dto";

describe("DecisionsService", () => {
  let service: DecisionsService;
  let insertedValues: Record<string, unknown> | undefined;
  let whereArg: unknown;

  const createdAt = new Date("2026-07-07T10:00:00.000Z");

  // Chaîne Drizzle : insert().values().returning() et select().from().where().orderBy().limit()
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
      return { orderBy };
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
    const dto: CreateDecisionDto = {
      typeDecision: "lien_confirme",
      objetAType: "projet",
      objetAId: "proj-a",
      objetBType: "projet",
      objetBId: "proj-b",
      verdict: "confirme",
    };

    it("dérive plateformeSource de l'argument (jamais du DTO) et renvoie id + createdAt ISO", async () => {
      service = buildService({ returning: [{ id: "dec-1", createdAt }] });

      const result = await service.create(dto, "MEC");

      expect(result).toEqual({ id: "dec-1", createdAt: "2026-07-07T10:00:00.000Z" });
      expect(insertedValues).toMatchObject({
        typeDecision: "lien_confirme",
        objetAType: "projet",
        objetAId: "proj-a",
        objetBType: "projet",
        objetBId: "proj-b",
        verdict: "confirme",
        plateformeSource: "MEC",
      });
    });

    it("persiste supersedes quand fourni (chaîne de révocation)", async () => {
      service = buildService({ returning: [{ id: "dec-3", createdAt }] });

      await service.create({ ...dto, supersedes: "dec-1" }, "MEC");

      expect(insertedValues).toMatchObject({ supersedes: "dec-1" });
    });

    it("normalise les champs optionnels absents en null (dont supersedes)", async () => {
      service = buildService({ returning: [{ id: "dec-2", createdAt }] });

      await service.create({ typeDecision: "projet_valide", objetAType: "projet", objetAId: "proj-a" }, "TeT");

      expect(insertedValues).toMatchObject({
        objetBType: null,
        objetBId: null,
        verdict: null,
        auteur: null,
        commentaire: null,
        payload: null,
        supersedes: null,
        plateformeSource: "TeT",
      });
    });
  });

  describe("findByObjet", () => {
    it("renvoie les décisions trouvées sous forme { items } et applique un filtre WHERE (cloisonnement)", async () => {
      const rows = [{ id: "dec-1" }, { id: "dec-2" }];
      service = buildService({ selectRows: rows });

      const result = await service.findByObjet("proj-a", "MEC");

      expect(result).toEqual({ items: rows });
      // Le cloisonnement par plateforme est appliqué dans la clause WHERE.
      expect(whereArg).toBeDefined();
    });
  });
});
