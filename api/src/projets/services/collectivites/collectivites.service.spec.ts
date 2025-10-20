import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { CollectivitesService } from "./collectivites.service";
import { collectivites, projets, projetsToCollectivites } from "@database/schema";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { GeoService } from "@/geo/geo-service";
import { Collectivite } from "@/geo/geo-api.service";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";

describe("CollectivitesService", () => {
  let collectivitesService: CollectivitesService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let projectId: string;

  const collectivite1Uuid = uuidv7();
  const collectivite2Uuid = uuidv7();
  const collectivite3Uuid = uuidv7();

  const geoServiceMock = {
    validateAndGetCollectivite: jest.fn(),
  };

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule([
      {
        provide: GeoService,
        useValue: geoServiceMock,
      },
    ]);
    module = internalModule;
    testDbService = tds;
    collectivitesService = module.get<CollectivitesService>(CollectivitesService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 10000);

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    jest.clearAllMocks();

    const [project] = await testDbService.database
      .insert(projets)
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

  describe("getCollectivitesIdsAndMissingRefs", () => {
    it("should return collectivite ids for valid references", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" },
          { type: "EPCI", code: "EPCI12345" },
        ];

        const { collectiviteIds, missingRefs } = await collectivitesService.getCollectivitesIdsAndMissingRefs(tx, refs);

        expect(collectiviteIds).toHaveLength(2);
        expect(collectiviteIds).toContain(collectivite1Uuid);
        expect(collectiviteIds).toContain(collectivite3Uuid);
        expect(missingRefs).toHaveLength(0);
      });
    });

    it("should return missingRefs for all collectivite references which are not in database", async () => {
      await testDbService.database.transaction(async (tx) => {
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "99999" },
          { type: "EPCI", code: "INVALID" },
        ];

        const { collectiviteIds, missingRefs } = await collectivitesService.getCollectivitesIdsAndMissingRefs(tx, refs);

        expect(collectiviteIds).toHaveLength(0);
        expect(missingRefs).toHaveLength(2);
        expect(missingRefs).toStrictEqual([
          { type: "Commune", code: "99999" },
          { type: "EPCI", code: "INVALID" },
        ]);
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
          .from(projetsToCollectivites)
          .where(eq(projetsToCollectivites.projetId, projectId));

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
          .from(projetsToCollectivites)
          .where(eq(projetsToCollectivites.projetId, projectId));

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
          new Error("At least one collectivite needs to be associated to the project"),
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
          .from(projetsToCollectivites)
          .where(eq(projetsToCollectivites.projetId, projectId));

        expect(relations).toHaveLength(1);
        expect(relations[0].collectiviteId).toBe(collectivite1Uuid);
      });
    });

    it("should create new collectivite if missing a valid one", async () => {
      await testDbService.database.transaction(async (tx) => {
        const newValidRef: CollectiviteReference = { type: "Commune", code: "99999" };
        const refs: CollectiviteReference[] = [
          { type: "Commune", code: "12345" }, // existing one
          newValidRef,
        ];

        geoServiceMock.validateAndGetCollectivite.mockImplementation((ref: CollectiviteReference): Collectivite => {
          return {
            nom: `Test ${ref.type}`,
            type: ref.type,
            codeInsee: ref.type === "Commune" ? ref.code : null,
            codeEpci: ref.type === "EPCI" ? ref.code : null,
            codeDepartements: ["01"],
            codeRegions: ["84"],
            siren: ref.code,
          };
        });

        await collectivitesService.createOrUpdateRelations(tx, projectId, refs);

        // Verify the relations were created
        const relations = await tx
          .select()
          .from(projetsToCollectivites)
          .where(eq(projetsToCollectivites.projetId, projectId));

        expect(relations).toHaveLength(2);

        // Verify the new collectivite was created in the database
        const newCollectivite = await tx
          .select()
          .from(collectivites)
          .where(eq(collectivites.codeInsee, "99999"))
          .limit(1);

        expect(newCollectivite).toHaveLength(1);
        expect(newCollectivite[0].type).toBe("Commune");
        expect(newCollectivite[0].codeInsee).toBe("99999");
        expect(newCollectivite[0].nom).toBe("Test Commune");
      });
    });
  });
});
