import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { CreateProjectsService } from "../create-projects/create-projects.service";
import { ExtraFieldsService } from "@projects/services/extra-fields/extra-fields.service";

describe("ExtraFieldService", () => {
  let createService: CreateProjectsService;
  let extraFieldsService: ExtraFieldsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  const mockedCommunes = ["01001", "75056", "97A01"];

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    createService = module.get<CreateProjectsService>(CreateProjectsService);
    extraFieldsService = module.get<ExtraFieldsService>(ExtraFieldsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  describe("getProjectExtraField", () => {
    it("should return default extrafields for a project", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        porteurCodeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        leviers: ["Bio-carburants"],
        communeInseeCodes: mockedCommunes,
        externalId: "test-service-id",
      };

      const createdProject = await createService.create(createDto, "MEC_test_api_key");
      const result = await extraFieldsService.getExtraFieldsByProjectId(createdProject.id);
      expect(result).toEqual({ extraFields: [] });
    });
  });

  describe("updateExtraFields", () => {
    it("should return updated extrafields for a project", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        porteurCodeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        leviers: ["Bio-carburants"],
        communeInseeCodes: mockedCommunes,
        externalId: "test-service-id",
      };

      const createdProject = await createService.create(createDto, "MEC_test_api_key");

      await extraFieldsService.createExtraFields(createdProject.id, {
        extraFields: [{ fieldName: "surface", fieldValue: "100" }],
      });
      const result = await extraFieldsService.getExtraFieldsByProjectId(createdProject.id);
      expect(result).toEqual({ extraFields: [{ fieldName: "surface", fieldValue: "100" }] });
    });
  });
});
