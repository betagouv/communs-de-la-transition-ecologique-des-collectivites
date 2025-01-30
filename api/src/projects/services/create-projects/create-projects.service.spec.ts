import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { CreateProjectsService } from "./create-projects.service";
import { projects, projectsToCommunes } from "@database/schema";
import { and, inArray } from "drizzle-orm";
import { ConflictException } from "@nestjs/common";

describe("ProjectCreateService", () => {
  let service: CreateProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  const mockedCommunes = ["01001", "75056", "97A01"];

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
  });

  describe("create", () => {
    it("should create a new project", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        communeInseeCodes: mockedCommunes,
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        externalId: "test-external-id",
      };

      const result = await service.create(createDto, "MEC_test_api_key");

      expect(result).toEqual({
        id: expect.any(String),
      });
    });

    it("should throw ConflictException when project with same externalId exists", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        communeInseeCodes: mockedCommunes,
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        externalId: "duplicate-id",
      };

      await service.create(createDto, "MEC_test_api_key");

      await expect(service.create(createDto, "MEC_test_api_key")).rejects.toThrow(
        new ConflictException("Project with mecId duplicate-id already exists"),
      );
    });

    it("should allow same externalId for different services", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        communeInseeCodes: mockedCommunes,
        externalId: "same-external-id",
      };

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
      const projectsToCreate = {
        projects: [
          {
            nom: "Test Project 1",
            description: "Test Description 1",
            budget: 100000,
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
            communeInseeCodes: ["75056"],
          },
          {
            nom: "Test Project 2",
            description: "Test Description 2",
            budget: 200000,
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
            communeInseeCodes: ["75057"],
          },
        ] as CreateProjectRequest[],
      };

      const result = await service.createBulk(projectsToCreate, "MEC_test_api_key");

      expect(result.ids).toHaveLength(2);

      // Verify projects were created
      const createdProjects = await testDbService.database
        .select()
        .from(projects)
        .where(inArray(projects.id, result.ids));

      expect(createdProjects).toHaveLength(2);

      // Verify communes were created and linked
      const projectCommunes = await testDbService.database
        .select()
        .from(projectsToCommunes)
        .where(
          and(
            inArray(
              projectsToCommunes.projectId,
              createdProjects.map((p) => p.id),
            ),
          ),
        );

      expect(projectCommunes).toHaveLength(2);
    });

    it("should rollback all changes if any project creation fails", async () => {
      const projectsToCreate = {
        projects: [
          {
            nom: "Test Project 1",
            description: "Test Description 1",
            budget: 100000,
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
            communeInseeCodes: ["75056"],
          },
          {
            nom: "Test Project 2",
            description: "Test Description 2",
            budget: "budget", // Invalid budget to trigger failure
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
            communeInseeCodes: ["75057"],
          },
        ] as CreateProjectRequest[],
      };

      await expect(service.createBulk(projectsToCreate, "MEC_test_api_key")).rejects.toThrow();

      // Verify no projects were created
      const createdProjects = await testDbService.database.select().from(projects);
      expect(createdProjects).toHaveLength(0);

      // Verify no commune relations were created
      const projectCommunes = await testDbService.database.select().from(projectsToCommunes);
      expect(projectCommunes).toHaveLength(0);
    });
  });
});
