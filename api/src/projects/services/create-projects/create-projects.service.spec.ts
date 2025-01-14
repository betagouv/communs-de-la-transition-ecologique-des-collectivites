// disabled to use expect any syntax
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { getFutureDate } from "@test/helpers/getFutureDate";
import { CreateProjectsService } from "./create-projects.service";

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
      forecastedStartDate: getFutureDate(),
      status: "IDEE",
      communeInseeCodes: mockedCommunes,
      competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
    };

    const result = await service.create(createDto);

    expect(result).toEqual({
      id: expect.any(String),
    });
  });
});
