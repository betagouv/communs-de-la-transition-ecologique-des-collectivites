import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { GetPlansService } from "./get-plans.service";
import { plansTransition, fichesAction, fichesActionToPlansTransition } from "@database/schema";

describe("GetPlansService", () => {
  let service: GetPlansService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<GetPlansService>(GetPlansService);
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
        collectiviteResponsableSiren: "200000001",
        tcDemarcheId: 100,
        ...overrides,
      })
      .returning();
    return plan;
  }

  describe("findAll", () => {
    it("should return paginated plans", async () => {
      await insertPlan({ nom: "Plan A", tcDemarcheId: 1 });
      await insertPlan({ nom: "Plan B", tcDemarcheId: 2 });
      await insertPlan({ nom: "Plan C", tcDemarcheId: 3 });

      const result = await service.findAll({ page: 1, limit: 2 });

      expect(result.total).toBe(3);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].nom).toBe("Plan A");
      expect(result.data[1].nom).toBe("Plan B");
    });

    it("should filter by siren", async () => {
      await insertPlan({ nom: "Plan A", tcDemarcheId: 1, collectiviteResponsableSiren: "111111111" });
      await insertPlan({ nom: "Plan B", tcDemarcheId: 2, collectiviteResponsableSiren: "222222222" });

      const result = await service.findAll({ siren: "111111111" });

      expect(result.total).toBe(1);
      expect(result.data[0].nom).toBe("Plan A");
    });

    it("should filter by type (case-insensitive)", async () => {
      await insertPlan({ nom: "Plan PCAET", tcDemarcheId: 1, type: "PCAET" });
      await insertPlan({ nom: "Plan autre", tcDemarcheId: 2, type: "PLUi" });

      const result = await service.findAll({ type: "pcaet" });

      expect(result.total).toBe(1);
      expect(result.data[0].nom).toBe("Plan PCAET");
    });

    it("should return empty result when no plans match", async () => {
      const result = await service.findAll({ siren: "999999999" });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("findOne", () => {
    it("should return a plan with linked fiches action", async () => {
      const plan = await insertPlan();
      const [fiche] = await testDbService.database
        .insert(fichesAction)
        .values({
          nom: "Fiche test",
          tcDemarcheId: 100,
          tcHash: "hash-test-1",
        })
        .returning();

      await testDbService.database.insert(fichesActionToPlansTransition).values({
        ficheActionId: fiche.id,
        planTransitionId: plan.id,
      });

      const result = await service.findOne(plan.id);

      expect(result.id).toBe(plan.id);
      expect(result.nom).toBe("PCAET Test");
      expect(result.fichesAction).toHaveLength(1);
      expect(result.fichesAction[0]).toMatchObject({
        id: fiche.id,
        nom: "Fiche test",
      });
    });

    it("should throw NotFoundException for unknown id", async () => {
      await expect(service.findOne("00000000-0000-0000-0000-000000000000")).rejects.toThrow(NotFoundException);
    });
  });
});
