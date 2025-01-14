// disabled to use expect any syntax
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getFormattedDate } from "@test/helpers/getFormattedDate";
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
      };
      const createDto2: CreateProjectRequest = {
        nom: "Project 2",
        description: "Description 2",
        budget: 100000,
        forecastedStartDate: getFormattedDate(),
        status: "IDEE",
        communeInseeCodes: mockedCommunes,
      };

      await createService.create(createDto1);
      await createService.create(createDto2);

      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        communeInseeCodes: communeCodesInProject1,
        ...expectedFieldsProject1
      } = createDto1;
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        communeInseeCodes: communeCodesInProject2,
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
        competencesAndSousCompetences: null,
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
      };

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsProject1,
        ...expectedCommonFields,
        porteurReferentEmail: "porteurReferentEmail@email.com",
        status: "IDEE",
      });

      expect(result[1]).toEqual({
        ...expectedFieldsProject2,
        ...expectedCommonFields,
        status: "IDEE",
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
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        communeInseeCodes: mockedCommunes,
      };

      const createdProject = await createService.create(createDto);
      const result = await findService.findOne(createdProject.id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { communeInseeCodes, competencesAndSousCompetences, ...expectedFields } = createDto;
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
        competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        status: "IDEE",
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(findService.findOne(nonExistentId)).rejects.toThrow(NotFoundException);
    });
  });
});
