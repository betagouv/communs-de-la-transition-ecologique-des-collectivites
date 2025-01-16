// disabled to use expect any syntax
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { getFormattedDate } from "@test/helpers/getFormattedDate";
import { CreateProjectsService } from "./create-projects.service";
import { projects, projectsToCommunes } from "@database/schema";
import { and, inArray } from "drizzle-orm";

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

  it("should create a new project", async () => {
    const createDto: CreateProjectRequest = {
      nom: "Test Project",
      description: "Test Description",
      budget: 100000,
      forecastedStartDate: getFormattedDate(),
      status: "IDEE",
      communeInseeCodes: mockedCommunes,
      competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
    };

    const result = await service.create(createDto);

    expect(result).toEqual({
      id: expect.any(String),
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

      const result = await service.createBulk(projectsToCreate);

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
            budget: -1, // Invalid budget to trigger failure
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
            communeInseeCodes: ["75057"],
          },
        ] as CreateProjectRequest[],
      };

      await expect(service.createBulk(projectsToCreate)).rejects.toThrow();

      // Verify no projects were created
      const createdProjects = await testDbService.database.select().from(projects);
      expect(createdProjects).toHaveLength(0);

      // Verify no commune relations were created
      const projectCommunes = await testDbService.database.select().from(projectsToCommunes);
      expect(projectCommunes).toHaveLength(0);
    });
  });
});
