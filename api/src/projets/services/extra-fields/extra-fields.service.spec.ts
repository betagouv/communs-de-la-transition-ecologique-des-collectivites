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

  const tetApiKey = process.env.TET_API_KEY!;
  const mecApiKey = process.env.MEC_API_KEY!;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    createService = module.get<CreateProjetsService>(CreateProjetsService);
    extraFieldsService = module.get<ExtraFieldsService>(ExtraFieldsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 10000);

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

      const createdProjet = await createService.create(createDto, mecApiKey);
      const result = await extraFieldsService.getExtraFieldsByProjetId(createdProjet.id, "communId");
      expect(result).toEqual([]);
    });

    it("should return default extrafields for a Projet with tetId", async () => {
      const createDto = mockProjetPayload({ externalId: "test-external-id" });

      await createService.create(createDto, tetApiKey);
      const result = await extraFieldsService.getExtraFieldsByProjetId(createDto.externalId, "tetId");
      expect(result).toEqual([]);
    });

    it("should return specific extrafields for a Projet", async () => {
      const createDto = mockProjetPayload();

      const createdProjet = await createService.create(createDto, mecApiKey);

      await extraFieldsService.createExtraFields(
        createdProjet.id,
        {
          extraFields: [{ name: "surface", value: "100" }],
        },
        "communId",
      );
      const result = await extraFieldsService.getExtraFieldsByProjetId(createdProjet.id, "communId");
      expect(result).toEqual([{ name: "surface", value: "100" }]);
    });

    it("should return specific extrafields for a projet with tetId", async () => {
      const createDto = mockProjetPayload({ externalId: "test-external-id" });

      await createService.create(createDto, tetApiKey);

      await extraFieldsService.createExtraFields(
        createDto.externalId,
        {
          extraFields: [{ name: "surface", value: "200" }],
        },
        "tetId",
      );
      const result = await extraFieldsService.getExtraFieldsByProjetId(createDto.externalId, "tetId");
      expect(result).toEqual([{ name: "surface", value: "200" }]);
    });
  });
});
