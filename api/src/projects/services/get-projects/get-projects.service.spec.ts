/* eslint-disable @typescript-eslint/no-unused-vars */
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { GetProjectsService } from "./get-projects.service";
import { CreateProjectsService } from "../create-projects/create-projects.service";

describe("ProjectFindService", () => {
  let findService: GetProjectsService;
  let createService: CreateProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  const mockedCommunes = ["01001", "75056", "97A01"];

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    findService = module.get<GetProjectsService>(GetProjectsService);
    createService = module.get<CreateProjectsService>(CreateProjectsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  describe("findAll", () => {
    it("should return all projects", async () => {
      const createDto1: CreateProjectRequest = {
        nom: "Project 1",
        description: "Description 1",
        porteurReferentEmail: "porteurReferentEmail@email.com",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        communeInseeCodes: mockedCommunes,
        externalId: "test-service-id-1",
      };
      const createDto2: CreateProjectRequest = {
        nom: "Project 2",
        description: "Description 2",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        communeInseeCodes: mockedCommunes,
        externalId: "test-service-id-2",
      };

      await createService.create(createDto1, "MEC_test_api_key");
      await createService.create(createDto2, "MEC_test_api_key");

      const { communeInseeCodes: communeCodesInProject1, externalId, ...expectedFieldsProject1 } = createDto1;
      const {
        communeInseeCodes: communeCodesInProject2,
        externalId: serviceIdInProject2,
        ...expectedFieldsProject2
      } = createDto2;

      const result = await findService.findAll();

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
        competences: null,
        leviers: null,
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
        tetId: null,
        recocoId: null,
      };

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsProject1,
        ...expectedCommonFields,
        porteurReferentEmail: "porteurReferentEmail@email.com",
        status: "IDEE",
        mecId: "test-service-id-1",
      });

      expect(result[1]).toEqual({
        ...expectedFieldsProject2,
        ...expectedCommonFields,
        status: "IDEE",
        mecId: "test-service-id-2",
      });
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
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
      const result = await findService.findOne(createdProject.id);
      const { communeInseeCodes, externalId, ...expectedFields } = createDto;
      expect(result).toEqual({
        ...expectedFields,
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
        porteurReferentEmail: null,
        porteurReferentFonction: null,
        porteurReferentNom: null,
        porteurReferentPrenom: null,
        porteurReferentTelephone: null,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        status: "IDEE",
        recocoId: null,
        mecId: "test-service-id",
        tetId: null,
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(findService.findOne(nonExistentId)).rejects.toThrow(NotFoundException);
    });
  });
});
