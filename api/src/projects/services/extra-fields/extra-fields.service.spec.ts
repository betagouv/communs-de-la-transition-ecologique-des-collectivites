import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { CreateProjectsService } from "../create-projects/create-projects.service";
import { ExtraFieldsService } from "@projects/services/extra-fields/extra-fields.service";
import { collectivites } from "@database/schema";
import { mockedDefaultCollectivites, mockProjectPayload } from "@test/mocks/mockProjectPayload";

describe("ExtraFieldService", () => {
  let createService: CreateProjectsService;
  let extraFieldsService: ExtraFieldsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

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
    await testDbService.database.insert(collectivites).values([
      {
        nom: "Commune 1",
        type: mockedDefaultCollectivites[0].type,
        codeInsee: mockedDefaultCollectivites[0].code,
      },
    ]);
  });

  describe("getExtraFieldsByProjectId", () => {
    it("should return default extrafields for a project", async () => {
      const createDto = mockProjectPayload();

      const createdProject = await createService.create(createDto, "MEC_test_api_key");
      const result = await extraFieldsService.getExtraFieldsByProjectId(createdProject.id);
      expect(result).toEqual({ extraFields: [] });
    });
  });

  describe("createExtraFields", () => {
    it("should return created extrafields for a project", async () => {
      const createDto = mockProjectPayload();

      const createdProject = await createService.create(createDto, "MEC_test_api_key");

      await extraFieldsService.createExtraFields(createdProject.id, {
        extraFields: [{ name: "surface", value: "100" }],
      });
      const result = await extraFieldsService.getExtraFieldsByProjectId(createdProject.id);
      expect(result).toEqual({ extraFields: [{ name: "surface", value: "100" }] });
    });
  });
});
