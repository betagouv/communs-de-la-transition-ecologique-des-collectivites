import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { CollectivitesService } from "./collectivites.service";
import { collectivites, projects, projectsToCollectivites } from "@database/schema";
import { CollectiviteReference } from "@projects/dto/collectivite.dto";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

describe("CollectivitesService", () => {
  let collectivitesService: CollectivitesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let projectId: string;

  const collectivite1Uuid = uuidv7();
  const collectivite2Uuid = uuidv7();
  const collectivite3Uuid = uuidv7();

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    collectivitesService = module.get<CollectivitesService>(CollectivitesService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();

    const [project] = await testDbService.database
      .insert(projects)
      .values({
        nom: "Test Project",
        description: "Test Description",
      })
      .returning();

    projectId = project.id;

    await testDbService.database.insert(collectivites).values([
      {
        id: collectivite1Uuid,
        nom: "Commune Test 1",
        type: "Commune",
        codeInsee: "12345",
      },
      {
        id: collectivite2Uuid,
        nom: "Commune Test 2",
        type: "Commune",
        codeInsee: "67890",
      },
      {
        id: collectivite3Uuid,
        nom: "EPCI Test 1",
        type: "EPCI",
        codeEpci: "EPCI12345",
      },
    ]);
  });

  describe("getCollectivitiesByRefs", () => {
    it("should return collectivite ids for valid references", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" },
          { type: "EPCI", code: "EPCI12345" },
        ];

        const result = await collectivitesService.getCollectivitesIdsByRefs(tx, refs);

        expect(result).toHaveLength(2);
        expect(result).toContain(collectivite1Uuid);
        expect(result).toContain(collectivite3Uuid);
      });
    });

    it("should skip invalid references", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" },
          { type: "Commune", code: "99999" }, // Non-existent
        ];

        const result = await collectivitesService.getCollectivitesIdsByRefs(tx, refs);

        expect(result).toHaveLength(1);
        expect(result).toContain(collectivite1Uuid);
      });
    });

    it("should return empty array for all invalid references", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "99999" },
          { type: "EPCI", code: "INVALID" },
        ];

        const result = await collectivitesService.getCollectivitesIdsByRefs(tx, refs);

        expect(result).toHaveLength(0);
      });
    });
  });

  describe("createOrUpdateRelations", () => {
    it("should create new relations between project and collectivites", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" },
          { type: "EPCI", code: "EPCI12345" },
        ];

        await collectivitesService.createOrUpdateRelations(tx, projectId, refs);

        const relations = await tx
          .select()
          .from(projectsToCollectivites)
          .where(eq(projectsToCollectivites.projectId, projectId));

        expect(relations).toHaveLength(2);
        expect(relations.map((r) => r.collectiviteId)).toContain(collectivite1Uuid);
        expect(relations.map((r) => r.collectiviteId)).toContain(collectivite3Uuid);
      });
    });

    it("should update relations by removing old ones and adding new ones", async () => {
      await testDbService.database.transaction(async (tx) => {
        // Create initial relations
        const initialRefs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" },
          { type: "Commune", code: "67890" },
        ];

        await collectivitesService.createOrUpdateRelations(tx, projectId, initialRefs);

        // Update relations
        const updatedRefs: CollectiviteReference[] = [
          { type: "Commune", code: "67890" },
          { type: "EPCI", code: "EPCI12345" },
        ];

        await collectivitesService.createOrUpdateRelations(tx, projectId, updatedRefs);

        const relations = await tx
          .select()
          .from(projectsToCollectivites)
          .where(eq(projectsToCollectivites.projectId, projectId));

        expect(relations).toHaveLength(2);
        expect(relations.map((r) => r.collectiviteId)).not.toContain(collectivite1Uuid); // Should be removed
        expect(relations.map((r) => r.collectiviteId)).toContain(collectivite2Uuid); // Should be kept
        expect(relations.map((r) => r.collectiviteId)).toContain(collectivite3Uuid); // Should be added
      });
    });

    it("should handle empty references by throwing", async () => {
      await testDbService.database.transaction(async (tx) => {
        // Create initial relations
        const initialRefs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" },
          { type: "EPCI", code: "EPCI12345" },
        ];

        await collectivitesService.createOrUpdateRelations(tx, projectId, initialRefs);

        // Update with empty refs
        await expect(collectivitesService.createOrUpdateRelations(tx, projectId, [])).rejects.toThrow(
          new Error("At least one collecitvite needs to be assiocated to the project"),
        );
      });
    });

    it("should not create duplicate relations", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [{ type: "Commune", code: "12345" }];

        // Create relation twice
        await collectivitesService.createOrUpdateRelations(tx, projectId, refs);
        await collectivitesService.createOrUpdateRelations(tx, projectId, refs);

        const relations = await tx
          .select()
          .from(projectsToCollectivites)
          .where(eq(projectsToCollectivites.projectId, projectId));

        expect(relations).toHaveLength(1);
        expect(relations[0].collectiviteId).toBe(collectivite1Uuid);
      });
    });
  });
});
