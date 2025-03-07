/* eslint-disable @typescript-eslint/no-unused-vars */
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { GetProjetsService } from "./get-projets.service";
import { collectivites } from "@database/schema";
import { mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";

describe("ProjetFindService", () => {
  let getProjetsService: GetProjetsService;
  let createProjetsService: CreateProjetsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  const mockedCollectivites: CollectiviteReference[] = [
    { type: "Commune", code: "01001" },
    { type: "EPCI", code: "123456789" },
    { type: "Commune", code: "75056" },
  ];

  const mockedCollectivitesDb = [
    { ...mockedCollectivites[0], nom: "Commune 1" },
    { ...mockedCollectivites[1], nom: "EPCI 1" },
    { ...mockedCollectivites[2], nom: "Commune 2" },
  ];

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    getProjetsService = module.get<GetProjetsService>(GetProjetsService);
    createProjetsService = module.get<CreateProjetsService>(CreateProjetsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    await testDbService.database.insert(collectivites).values([
      {
        nom: "Commune 1",
        type: "Commune",
        codeInsee: "01001",
      },
      {
        nom: "EPCI 1",
        type: "EPCI",
        codeEpci: "123456789",
      },
      {
        nom: "Commune 2",
        type: "Commune",
        codeInsee: "75056",
      },
    ]);
  });

  const expectedCommonFields = {
    id: expect.any(String),
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
    porteurCodeSiret: null,
    porteurReferentEmail: null,
    porteurReferentFonction: null,
    porteurReferentNom: null,
    porteurReferentPrenom: null,
    porteurReferentTelephone: null,
    source: null,
    leviers: ["Bio-carburants"],
    competences: ["Santé", "Culture > Arts plastiques et photographie"],
    budget: 100000,
    collectivites: expect.arrayContaining(
      mockedCollectivites.map(({ code, type }, index) => ({
        codeInsee: type === "Commune" ? code : null,
        codeEpci: type === "EPCI" ? code : null,
        type: type,
        siren: null,
        codeDepartements: null,
        codeRegions: null,
        nom: mockedCollectivitesDb[index].nom,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })),
    ),
    tetId: null,
    recocoId: null,
  };

  describe("findAll", () => {
    it("should return all Projets", async () => {
      const createDto1 = mockProjetPayload({
        collectivites: mockedCollectivites,
        externalId: "test-service-id-1",
      });

      const createDto2 = mockProjetPayload({
        collectivites: mockedCollectivites,
        externalId: "test-service-id-2",
      });

      await createProjetsService.create(createDto1, "MEC_test_api_key");
      await createProjetsService.create(createDto2, "MEC_test_api_key");

      const { collectivites, externalId, ...expectedFieldsProjet1 } = createDto1;

      const {
        externalId: serviceIdInProjet2,
        collectivites: collectivitesRefInProjet2,
        ...expectedFieldsProjet2
      } = createDto2;

      const result = await getProjetsService.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsProjet1,
        ...expectedCommonFields,
        mecId: "test-service-id-1",
      });

      expect(result[1]).toEqual({
        ...expectedFieldsProjet2,
        ...expectedCommonFields,
        mecId: "test-service-id-2",
      });
    });
  });

  describe("findOne", () => {
    it("should return a Projet by id", async () => {
      const createDto = mockProjetPayload({
        collectivites: mockedCollectivites,
        externalId: "test-service-id",
      });

      const createdProjet = await createProjetsService.create(createDto, "MEC_test_api_key");
      const result = await getProjetsService.findOne(createdProjet.id);
      const { externalId, collectivites, ...expectedFields } = createDto;

      expect(result).toEqual({
        ...expectedCommonFields,
        ...expectedFields,
        mecId: "test-service-id",
      });
    });

    it("should return extrafields for a Projet", async () => {
      const createDto = mockProjetPayload({
        collectivites: mockedCollectivites,
        externalId: "test-service-id",
      });

      const createdProjet = await createProjetsService.create(createDto, "MEC_test_api_key");
      const result = await getProjetsService.findOne(createdProjet.id);
      const { externalId, collectivites, ...expectedFields } = createDto;

      expect(result).toEqual({
        ...expectedCommonFields,
        ...expectedFields,
        mecId: "test-service-id",
      });
    });

    it("should throw NotFoundException when Projet not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(getProjetsService.findOne(nonExistentId)).rejects.toThrow(NotFoundException);
    });
  });
});
