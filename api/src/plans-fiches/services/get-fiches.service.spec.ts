import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { GetFichesService } from "./get-fiches.service";
import { plansTransition, fichesAction, fichesActionToPlansTransition } from "@database/schema";

describe("GetFichesService", () => {
  let service: GetFichesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<GetFichesService>(GetFichesService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 10000);

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  async function insertPlan(overrides: Partial<typeof plansTransition.$inferInsert> = {}) {
    const [plan] = await testDbService.database
      .insert(plansTransition)
      .values({
        nom: "PCAET Test",
        type: "PCAET",
        tcDemarcheId: 100,
        ...overrides,
      })
      .returning();
    return plan;
  }

  async function insertFiche(overrides: Partial<typeof fichesAction.$inferInsert> = {}) {
    const [fiche] = await testDbService.database
      .insert(fichesAction)
      .values({
        nom: "Fiche test",
        tcDemarcheId: 100,
        tcHash: `hash-${Date.now()}-${Math.random()}`,
        ...overrides,
      })
      .returning();
    return fiche;
  }

  async function linkFicheToPlan(ficheId: string, planId: string) {
    await testDbService.database.insert(fichesActionToPlansTransition).values({
      ficheActionId: ficheId,
      planTransitionId: planId,
    });
  }

  describe("findAll", () => {
    it("should return paginated fiches", async () => {
      await insertFiche({ nom: "Fiche A", tcHash: "hash-a" });
      await insertFiche({ nom: "Fiche B", tcHash: "hash-b" });
      await insertFiche({ nom: "Fiche C", tcHash: "hash-c" });

      const result = await service.findAll({ page: 1, limit: 2 });

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
    });

    it("should filter by siren", async () => {
      await insertFiche({ nom: "Fiche A", tcHash: "hash-a", collectiviteResponsableSiren: "111111111" });
      await insertFiche({ nom: "Fiche B", tcHash: "hash-b", collectiviteResponsableSiren: "222222222" });

      const result = await service.findAll({ siren: "111111111" });

      expect(result.total).toBe(1);
      expect(result.data[0].nom).toBe("Fiche A");
    });

    it("should search by name (case-insensitive)", async () => {
      await insertFiche({ nom: "Rénovation bâtiments", tcHash: "hash-a" });
      await insertFiche({ nom: "Mobilité douce", tcHash: "hash-b" });

      const result = await service.findAll({ search: "rénovation" });

      expect(result.total).toBe(1);
      expect(result.data[0].nom).toBe("Rénovation bâtiments");
    });

    it("should filter by planId", async () => {
      const plan1 = await insertPlan({ nom: "Plan 1", tcDemarcheId: 1 });
      const plan2 = await insertPlan({ nom: "Plan 2", tcDemarcheId: 2 });
      const fiche1 = await insertFiche({ nom: "Fiche pour Plan 1", tcHash: "hash-1" });
      const fiche2 = await insertFiche({ nom: "Fiche pour Plan 2", tcHash: "hash-2" });
      await linkFicheToPlan(fiche1.id, plan1.id);
      await linkFicheToPlan(fiche2.id, plan2.id);

      const result = await service.findAll({ planId: plan1.id });

      expect(result.total).toBe(1);
      expect(result.data[0].nom).toBe("Fiche pour Plan 1");
    });

    it("should combine planId and search filters", async () => {
      const plan = await insertPlan({ tcDemarcheId: 1 });
      const fiche1 = await insertFiche({ nom: "Rénovation bâtiments", tcHash: "hash-1" });
      const fiche2 = await insertFiche({ nom: "Mobilité douce", tcHash: "hash-2" });
      await linkFicheToPlan(fiche1.id, plan.id);
      await linkFicheToPlan(fiche2.id, plan.id);

      const result = await service.findAll({ planId: plan.id, search: "mobilité" });

      expect(result.total).toBe(1);
      expect(result.data[0].nom).toBe("Mobilité douce");
    });
  });

  describe("findOne", () => {
    it("should return a fiche with linked plans", async () => {
      const plan = await insertPlan();
      const fiche = await insertFiche({ nom: "Fiche détaillée", tcHash: "hash-detail" });
      await linkFicheToPlan(fiche.id, plan.id);

      const result = await service.findOne(fiche.id);

      expect(result.id).toBe(fiche.id);
      expect(result.nom).toBe("Fiche détaillée");
      expect(result.plansTransition).toHaveLength(1);
      expect(result.plansTransition[0]).toMatchObject({
        id: plan.id,
        nom: "PCAET Test",
        type: "PCAET",
      });
    });

    it("should return empty plansTransition when no links exist", async () => {
      const fiche = await insertFiche({ tcHash: "hash-no-links" });

      const result = await service.findOne(fiche.id);

      expect(result.plansTransition).toHaveLength(0);
    });

    it("should throw NotFoundException for unknown id", async () => {
      await expect(service.findOne("00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundException);
    });
  });
});
