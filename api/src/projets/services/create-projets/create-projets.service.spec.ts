import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjetRequest } from "../../dto/create-projet.dto";
import { TestingModule } from "@nestjs/testing";
import { CreateProjetsService } from "./create-projets.service";
import { collectivites, projets, projetsToCollectivites } from "@database/schema";
import { and, inArray } from "drizzle-orm";
import { ConflictException } from "@nestjs/common";
import { BulkCreateProjetsRequest } from "@projets/dto/bulk-create-projets.dto";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";

describe("ProjectCreateService", () => {
  let service: CreateProjetsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<CreateProjetsService>(CreateProjetsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    await testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune 1",
    });
  });

  describe("create", () => {
    it("should create a new project", async () => {
      const createDto = mockProjetPayload();

      const result = await service.create(createDto, "MEC_test_api_key");

      expect(result).toEqual({
        id: expect.any(String),
      });
    });

    it("should throw ConflictException when project with same externalId exists", async () => {
      const createDto = mockProjetPayload({ externalId: "duplicate-id" });

      await service.create(createDto, "MEC_test_api_key");

      await expect(service.create(createDto, "MEC_test_api_key")).rejects.toThrow(
        new ConflictException("Projet with mecId duplicate-id already exists"),
      );
    });

    it("should allow same externalId for different services", async () => {
      const createDto = mockProjetPayload();

      // Create project with MEC API key
      await service.create(createDto, "MEC_test_api_key");

      // Should succeed with TET API key
      await expect(service.create(createDto, "TET_test_api_key")).resolves.toEqual({
        id: expect.any(String),
      });
    });
  });

  describe("createBulk", () => {
    it("should create multiple projects in a transaction", async () => {
      const projectsToCreate: BulkCreateProjetsRequest = {
        projects: [mockProjetPayload(), mockProjetPayload({ nom: "Test Project 2", externalId: "test-external-id-2" })],
      };

      const result = await service.createBulk(projectsToCreate, "MEC_test_api_key");

      expect(result.ids).toHaveLength(2);

      // Verify projects were created
      const createdProjects = await testDbService.database
        .select()
        .from(projets)
        .where(inArray(projets.id, result.ids));

      expect(createdProjects).toHaveLength(2);

      // Verify collectivites were created and linked
      const projectCollectivites = await testDbService.database
        .select()
        .from(projetsToCollectivites)
        .where(
          and(
            inArray(
              projetsToCollectivites.projetId,
              createdProjects.map((p) => p.id),
            ),
          ),
        );

      expect(projectCollectivites).toHaveLength(2);
    });

    it("should rollback all changes if any project creation fails", async () => {
      const projectsToCreate = {
        projects: [mockProjetPayload(), mockProjetPayload({ nom: "Test Project 2" })] as CreateProjetRequest[],
      };

      await expect(service.createBulk(projectsToCreate, "MEC_test_api_key")).rejects.toThrow();

      // Verify no projects were created
      const createdProjects = await testDbService.database.select().from(projets);
      expect(createdProjects).toHaveLength(0);

      // Verify no collectivites relations were created
      const projectCollectivites = await testDbService.database.select().from(projetsToCollectivites);
      expect(projectCollectivites).toHaveLength(0);
    });
  });
});
