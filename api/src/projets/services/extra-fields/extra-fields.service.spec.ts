import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { collectivites } from "@database/schema";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { ExtraFieldsService } from "@projets/services/extra-fields/extra-fields.service";

describe("ExtraFieldService", () => {
  let createService: CreateProjetsService;
  let extraFieldsService: ExtraFieldsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    createService = module.get<CreateProjetsService>(CreateProjetsService);
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
        type: mockedDefaultCollectivite.type,
        codeInsee: mockedDefaultCollectivite.code,
      },
    ]);
  });

  describe("getExtraFieldsByProjetId", () => {
    it("should return default extrafields for a Projet", async () => {
      const createDto = mockProjetPayload();

      const createdProjet = await createService.create(createDto, "MEC_test_api_key");
      const result = await extraFieldsService.getExtraFieldsByProjetId(createdProjet.id);
      expect(result).toEqual([]);
    });
  });

  describe("createExtraFields", () => {
    it("should return created extrafields for a Projet", async () => {
      const createDto = mockProjetPayload();

      const createdProjet = await createService.create(createDto, "MEC_test_api_key");

      await extraFieldsService.createExtraFields(createdProjet.id, {
        extraFields: [{ name: "surface", value: "100" }],
      });
      const result = await extraFieldsService.getExtraFieldsByProjetId(createdProjet.id);
      expect(result).toEqual([{ name: "surface", value: "100" }]);
    });
  });
});
