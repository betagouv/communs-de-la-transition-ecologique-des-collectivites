import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { CreateProjectsService } from "./create-projects.service";
import { collectivites, projects, projectsToCollectivites } from "@database/schema";
import { and, inArray } from "drizzle-orm";
import { ConflictException } from "@nestjs/common";
import { BulkCreateProjectsRequest } from "@projects/dto/bulk-create-projects.dto";
import { mockedDefaultCollectivite, mockProjectPayload } from "@test/mocks/mockProjectPayload";

describe("ProjectCreateService", () => {
  let service: CreateProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<CreateProjectsService>(CreateProjectsService);
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
      const createDto = mockProjectPayload();

      const result = await service.create(createDto, "MEC_test_api_key");

      expect(result).toEqual({
        id: expect.any(String),
      });
    });

    it("should throw ConflictException when project with same externalId exists", async () => {
      const createDto = mockProjectPayload({ externalId: "duplicate-id" });

      await service.create(createDto, "MEC_test_api_key");

      await expect(service.create(createDto, "MEC_test_api_key")).rejects.toThrow(
        new ConflictException("Project with mecId duplicate-id already exists"),
      );
    });

    it("should allow same externalId for different services", async () => {
      const createDto = mockProjectPayload();

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
      const projectsToCreate: BulkCreateProjectsRequest = {
        projects: [
          mockProjectPayload(),
          mockProjectPayload({ nom: "Test Project 2", externalId: "test-external-id-2" }),
        ],
      };

      const result = await service.createBulk(projectsToCreate, "MEC_test_api_key");

      expect(result.ids).toHaveLength(2);

      // Verify projects were created
      const createdProjects = await testDbService.database
        .select()
        .from(projects)
        .where(inArray(projects.id, result.ids));

      expect(createdProjects).toHaveLength(2);

      // Verify collectivites were created and linked
      const projectCollectivites = await testDbService.database
        .select()
        .from(projectsToCollectivites)
        .where(
          and(
            inArray(
              projectsToCollectivites.projectId,
              createdProjects.map((p) => p.id),
            ),
          ),
        );

      expect(projectCollectivites).toHaveLength(2);
    });

    it("should rollback all changes if any project creation fails", async () => {
      const projectsToCreate = {
        projects: [mockProjectPayload(), mockProjectPayload({ nom: "Test Project 2" })] as CreateProjectRequest[],
      };

      await expect(service.createBulk(projectsToCreate, "MEC_test_api_key")).rejects.toThrow();

      // Verify no projects were created
      const createdProjects = await testDbService.database.select().from(projects);
      expect(createdProjects).toHaveLength(0);

      // Verify no collectivites relations were created
      const projectCollectivites = await testDbService.database.select().from(projectsToCollectivites);
      expect(projectCollectivites).toHaveLength(0);
    });
  });
});
