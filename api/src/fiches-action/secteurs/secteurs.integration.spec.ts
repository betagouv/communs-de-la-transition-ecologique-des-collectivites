import { TestingModule } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { NotFoundException } from "@nestjs/common";
import { FichesActionService } from "../fiches-action.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { tetExternalIds, tetFichesAction, tetFichesActionToPlans, tetPlansTransition } from "@database/schema";

describe("FichesActionService.getSecteurs - Integration Tests", () => {
  let service: FichesActionService;
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<FichesActionService>(FichesActionService);
  });

  beforeEach(async () => {
    const db = testDbService.database;
    await db.delete(tetFichesActionToPlans);
    await db.delete(tetExternalIds);
    await db.delete(tetFichesAction);
    await db.delete(tetPlansTransition);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 30000);

  async function insertFiche(overrides: Partial<typeof tetFichesAction.$inferInsert> = {}) {
    const db = testDbService.database;
    const [fiche] = await db
      .insert(tetFichesAction)
      .values({ nom: "Fiche secteurs", ...overrides })
      .returning({ id: tetFichesAction.id });
    return fiche.id;
  }

  it("computes both semantics from persisted classification scores and leviers", async () => {
    const ficheId = await insertFiche({
      classificationScores: {
        thematiques: [{ label: "Gestion des déchets", score: 0.9 }],
        sites: [{ label: "Bâtiment public", score: 0.5 }],
        interventions: [],
      },
      leviersSgpe: ["Prévention des déchets"],
    });

    const result = await service.getSecteurs(ficheId);

    expect(result.id).toBe(ficheId);
    expect(result.methode).toBe("mapping-jean-v1/agregation-jean-v1");
    expect(result.secteursDirect).not.toBeNull();
    expect(result.secteursDirect!.dominant).toBe("dechets");
    // masses : dechets 0.9 + 1.5 = 2.4 ; tertiaire 0.35×0.5 = 0.175 ; + lissage 0.5 → T = 3.075
    expect(result.secteursDirect!.parts.dechets).toBeCloseTo(2.4 / 3.075, 4);
    expect(result.secteursDirect!.parts.tertiaire).toBeCloseTo(0.175 / 3.075, 4);
    expect(result.secteursContribution!.dominant).toBe("dechets");
  });

  it("returns null semantics for a fiche without classification nor leviers", async () => {
    const ficheId = await insertFiche();

    const result = await service.getSecteurs(ficheId);

    expect(result.secteursDirect).toBeNull();
    expect(result.secteursContribution).toBeNull();
  });

  it("resolves a TeT externalId when the param is not a UUID", async () => {
    const db = testDbService.database;
    const ficheId = await insertFiche({
      classificationScores: {
        thematiques: [{ label: "Eclairage public", score: 1 }],
        sites: [],
        interventions: [],
      },
    });
    await db.insert(tetExternalIds).values({
      objetId: ficheId,
      serviceType: "TeT",
      objetType: "fiche_action",
      externalId: "136180",
    });

    const result = await service.getSecteurs("136180");

    expect(result.id).toBe(ficheId);
    expect(result.secteursDirect).not.toBeNull();
  });

  it("throws a 404 for an unknown id", async () => {
    await expect(service.getSecteurs("00000000-0000-7000-8000-000000000000")).rejects.toThrow(NotFoundException);
    await expect(service.getSecteurs("999999")).rejects.toThrow(NotFoundException);
  });

  it("keeps sectors in sync with labels (recompute on read, no persistence)", async () => {
    const db = testDbService.database;
    const ficheId = await insertFiche({
      classificationScores: {
        thematiques: [{ label: "Gestion des déchets", score: 1 }],
        sites: [],
        interventions: [],
      },
    });
    const before = await service.getSecteurs(ficheId);
    expect(before.secteursDirect!.dominant).toBe("dechets");

    await db
      .update(tetFichesAction)
      .set({
        classificationScores: {
          thematiques: [{ label: "Transports en commun", score: 1 }],
          sites: [],
          interventions: [],
        },
      })
      .where(eq(tetFichesAction.id, ficheId));

    const after = await service.getSecteurs(ficheId);
    expect(after.secteursDirect!.dominant).not.toBe("dechets");
  });
});
