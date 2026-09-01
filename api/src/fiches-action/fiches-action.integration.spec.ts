import { TestingModule } from "@nestjs/testing";
import { eq, and } from "drizzle-orm";
import { FichesActionService } from "./fiches-action.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { tetExternalIds, tetPlansTransition, tetFichesAction, tetFichesActionToPlans } from "@database/schema";
import { CreateFicheActionRequest } from "./dto/create-fiche-action.dto";

/**
 * Integration tests for FichesActionService against a real database.
 *
 * Regression tests for the external_ids namespace collision (prod incident):
 * TeT fiche ids and plan ids come from distinct sequences, so a plan's
 * externalId can equal an already-ingested fiche's externalId. Without an
 * object-type discriminant in external_ids, the plan lookup returned the
 * fiche's UUID → FK violation on fiches_action_to_plans (or, in the reverse
 * direction, a silently dropped fiche upsert).
 */
describe("FichesActionService - Integration Tests", () => {
  let service: FichesActionService;
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  const ficheDto = (overrides: Partial<CreateFicheActionRequest>): CreateFicheActionRequest =>
    ({
      nom: "Fiche test",
      externalId: "1",
      collectivites: [],
      ...overrides,
    }) as CreateFicheActionRequest;

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
  }, 10000);

  describe("external id namespace collision (fiche vs plan)", () => {
    it("should create the plan and its link when the plan externalId equals an existing fiche externalId", async () => {
      // A fiche already ingested under externalId "31000"
      await service.createOrUpdate(ficheDto({ nom: "Vieille fiche", externalId: "31000" }));

      // A new fiche arrives whose plan carries the SAME externalId "31000"
      // (distinct sequence on TeT side — this is a plan id, not a fiche id)
      const { id } = await service.createOrUpdate(
        ficheDto({
          nom: "Nouvelle fiche",
          externalId: "140000",
          plans: [{ externalId: "31000", nom: "PCAET Grand Sud", type: "PCAET" }],
        }),
      );

      const fiche = await service.findOne(id);
      expect(fiche.nom).toBe("Nouvelle fiche");
      expect(fiche.plans).toHaveLength(1);
      expect(fiche.plans[0].nom).toBe("PCAET Grand Sud");

      // The plan must exist as a real plans_transition row, distinct from the fiche
      const db = testDbService.database;
      const plans = await db.select().from(tetPlansTransition);
      expect(plans).toHaveLength(1);
      expect(plans[0].id).not.toBe(fiche.id);
    });

    it("should create the fiche when its externalId equals an existing plan externalId", async () => {
      // A plan already ingested under externalId "500" (via a first fiche)
      await service.createOrUpdate(
        ficheDto({ nom: "Fiche porteuse", externalId: "140001", plans: [{ externalId: "500", nom: "Plan A" }] }),
      );

      // A new fiche arrives whose OWN externalId is "500" (fiche sequence)
      const { id } = await service.createOrUpdate(ficheDto({ nom: "Fiche 500", externalId: "500" }));

      const fiche = await service.findOne(id);
      expect(fiche.nom).toBe("Fiche 500");
      expect(fiche.externalIds.TeT).toBe("500");

      // The plan is untouched
      const db = testDbService.database;
      const plans = await db.select().from(tetPlansTransition);
      expect(plans).toHaveLength(1);
      expect(plans[0].nom).toBe("Plan A");
    });

    it("should resolve parentExternalId against fiches only, never against a plan", async () => {
      // A plan mapped under externalId "600"
      await service.createOrUpdate(
        ficheDto({ nom: "Fiche porteuse", externalId: "140002", plans: [{ externalId: "600", nom: "Plan B" }] }),
      );

      // A fiche referencing parentExternalId "600" — no fiche has this id, so
      // the parent must resolve to null (NOT to the plan's UUID)
      const { id } = await service.createOrUpdate(
        ficheDto({ nom: "Sous-action", externalId: "140003", parentExternalId: "600" }),
      );

      const fiche = await service.findOne(id);
      expect(fiche.parentId).toBeNull();
    });
  });

  describe("plan upsert semantics", () => {
    it("should update an existing plan (same externalId) instead of duplicating it", async () => {
      await service.createOrUpdate(
        ficheDto({ nom: "F1", externalId: "140010", plans: [{ externalId: "700", nom: "Plan v1" }] }),
      );
      const { id } = await service.createOrUpdate(
        ficheDto({ nom: "F2", externalId: "140011", plans: [{ externalId: "700", nom: "Plan v2" }] }),
      );

      const db = testDbService.database;
      const plans = await db.select().from(tetPlansTransition);
      expect(plans).toHaveLength(1);
      expect(plans[0].nom).toBe("Plan v2");

      const fiche = await service.findOne(id);
      expect(fiche.plans).toHaveLength(1);
    });

    it("should self-heal an orphan plan mapping (mapping exists, plan row missing)", async () => {
      // Simulate the orphan-mapping corruption: an external_ids row whose
      // objet_id points to a plans_transition row that no longer exists.
      const db = testDbService.database;
      const ghostPlanId = "01900000-0000-7000-8000-000000000001";
      await db.insert(tetExternalIds).values({
        objetId: ghostPlanId,
        serviceType: "TeT",
        objetType: "plan_transition",
        externalId: "800",
      });

      const { id } = await service.createOrUpdate(
        ficheDto({ nom: "F3", externalId: "140020", plans: [{ externalId: "800", nom: "Plan fantôme" }] }),
      );

      // The plan row must be recreated under the mapped UUID and linked
      const [plan] = await db.select().from(tetPlansTransition).where(eq(tetPlansTransition.id, ghostPlanId));
      expect(plan).toBeDefined();
      expect(plan.nom).toBe("Plan fantôme");

      const fiche = await service.findOne(id);
      expect(fiche.plans).toHaveLength(1);
    });
  });

  describe("transactional upsert", () => {
    it("should keep existing plan links when the webhook re-sends the same fiche", async () => {
      const dto = ficheDto({
        nom: "F4",
        externalId: "140030",
        plans: [{ externalId: "900", nom: "Plan C" }],
      });
      const { id: firstId } = await service.createOrUpdate(dto);
      const { id: secondId } = await service.createOrUpdate(dto);

      expect(secondId).toBe(firstId);
      const fiche = await service.findOne(firstId);
      expect(fiche.plans).toHaveLength(1);

      // Exactly one mapping per object, typed
      const db = testDbService.database;
      const mappings = await db
        .select()
        .from(tetExternalIds)
        .where(and(eq(tetExternalIds.serviceType, "TeT"), eq(tetExternalIds.externalId, "900")));
      expect(mappings).toHaveLength(1);
      expect(mappings[0].objetType).toBe("plan_transition");
    });
  });
});
