/* eslint-disable @typescript-eslint/no-unused-vars */
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { GetProjectsService } from "./get-projects.service";
import { CreateProjectsService } from "../create-projects/create-projects.service";
import { CollectiviteReference } from "@projects/dto/collectivite.dto";
import { collectivites } from "@database/schema";
import { mockProjectPayload } from "@test/mocks/mockProjectPayload";

describe("ProjectFindService", () => {
  let getProjectsService: GetProjectsService;
  let createProjectsService: CreateProjectsService;
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
    getProjectsService = module.get<GetProjectsService>(GetProjectsService);
    createProjectsService = module.get<CreateProjectsService>(CreateProjectsService);
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
    it("should return all projects", async () => {
      const createDto1 = mockProjectPayload({
        collectivitesRef: mockedCollectivites,
        externalId: "test-service-id-1",
      });

      const createDto2 = mockProjectPayload({
        collectivitesRef: mockedCollectivites,
        externalId: "test-service-id-2",
      });

      await createProjectsService.create(createDto1, "MEC_test_api_key");
      await createProjectsService.create(createDto2, "MEC_test_api_key");

      const { collectivitesRef, externalId, ...expectedFieldsProject1 } = createDto1;

      const {
        externalId: serviceIdInProject2,
        collectivitesRef: collectivitesRefInProject2,
        ...expectedFieldsProject2
      } = createDto2;

      const result = await getProjectsService.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsProject1,
        ...expectedCommonFields,
        mecId: "test-service-id-1",
      });

      expect(result[1]).toEqual({
        ...expectedFieldsProject2,
        ...expectedCommonFields,
        mecId: "test-service-id-2",
      });
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
      const createDto = mockProjectPayload({
        collectivitesRef: mockedCollectivites,
        externalId: "test-service-id",
      });

      const createdProject = await createProjectsService.create(createDto, "MEC_test_api_key");
      const result = await getProjectsService.findOne(createdProject.id);
      const { externalId, collectivitesRef, ...expectedFields } = createDto;

      expect(result).toEqual({
        ...expectedCommonFields,
        ...expectedFields,
        mecId: "test-service-id",
      });
    });

    it("should return extrafields for a project", async () => {
      const createDto = mockProjectPayload({
        collectivitesRef: mockedCollectivites,
        externalId: "test-service-id",
      });

      const createdProject = await createProjectsService.create(createDto, "MEC_test_api_key");
      const result = await getProjectsService.findOne(createdProject.id);
      const { externalId, collectivitesRef, ...expectedFields } = createDto;

      expect(result).toEqual({
        ...expectedCommonFields,
        ...expectedFields,
        mecId: "test-service-id",
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(getProjectsService.findOne(nonExistentId)).rejects.toThrow(NotFoundException);
    });
  });
});
