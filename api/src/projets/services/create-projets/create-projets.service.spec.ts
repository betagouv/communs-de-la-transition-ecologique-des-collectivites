import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { CreateProjetsService } from "./create-projets.service";
import { collectivites, projets, projetsToCollectivites } from "@database/schema";
import { and, eq, inArray } from "drizzle-orm";
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
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should create a new project", async () => {
      const createDto = mockProjetPayload();

      const result = await service.create(createDto, "MEC_test_api_key");

      expect(result).toEqual({
        id: expect.any(String),
      });
    });

    it("should update a project if it is an existing one", async () => {
      const createDto = mockProjetPayload();

      const createdProject = await service.create(createDto, "MEC_test_api_key");
      await service.create({ ...createDto, nom: "Updated Project" }, "MEC_test_api_key");

      expect(createdProject).toEqual({
        id: expect.any(String),
      });

      const [updatedProject] = await testDbService.database
        .select()
        .from(projets)
        .where(eq(projets.id, createdProject.id));

      expect(updatedProject).toMatchObject({
        nom: "Updated Project",
        id: createdProject.id,
      });
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

    it("should not trigger a qualification job when competences are  already filled in", async () => {
      const createDto = mockProjetPayload();
      await service.create(createDto, "MEC_test_api_key");

      const spyOnSchedule = jest.spyOn(service as any, "scheduleProjectQualification");

      await service.create({ ...createDto, budgetPrevisionnel: 10000 }, "MEC_test_api_key");

      expect(spyOnSchedule).not.toHaveBeenCalled();
    });

    it("should trigger a qualification job when competences are not already filled in", async () => {
      const createDto = mockProjetPayload({ competences: [] });
      await service.create(createDto, "MEC_test_api_key");

      const spyOnSchedule = jest.spyOn(service as any, "scheduleProjectQualification");

      await service.create({ ...createDto, budgetPrevisionnel: 10000 }, "MEC_test_api_key");

      expect(spyOnSchedule).toHaveBeenCalled();
    });
  });

  describe("createBulk", () => {
    it("should create multiple projects in a transaction", async () => {
      const projectsToCreate: BulkCreateProjetsRequest = {
        projets: [mockProjetPayload(), mockProjetPayload({ nom: "Test Project 2", externalId: "test-external-id-2" })],
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
  });
});
