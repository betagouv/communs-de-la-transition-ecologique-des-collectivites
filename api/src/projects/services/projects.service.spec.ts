import { ProjectsService } from "./projects.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateProjectDto } from "../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getFutureDate } from "@test/helpers/getFutureDate";

describe("ProjectsService", () => {
  let service: ProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  const mockedCommunes = ["01001", "75056", "97A01"];

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<ProjectsService>(ProjectsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
  });

  describe("create", () => {
    it("should create a new project", async () => {
      const createDto: CreateProjectDto = {
        nom: "Test Project",
        description: "Test Description",
        porteurReferent: {
          email: "porteurEmail@beta.gouv.fr",
          nom: "Name",
        },
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };

      const result = await service.create(createDto);

      expect(result).toEqual({
        id: expect.any(String),
      });
    });
  });

  describe("findAll", () => {
    it("should return all projects", async () => {
      const futureDate = getFutureDate();
      const createDto1: CreateProjectDto = {
        nom: "Project 1",
        description: "Description 1",
        porteurReferent: {
          email: "porteurEmail@beta.gouv.fr",
          nom: "Name",
        },
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: futureDate,
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };
      const createDto2: CreateProjectDto = {
        nom: "Project 2",
        description: "Description 2",
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: futureDate,
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };

      await service.create(createDto1);
      await service.create(createDto2);

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

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsProject1,
        porteurReferent: {
          ...createDto1.porteurReferent,
          prenom: null,
          telephone: null,
          id: expect.any(String),
        },
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            id: expect.any(String),
            inseeCode: code,
          })),
        ),
      });
      expect(result[1]).toEqual({
        ...expectedFieldsProject2,
        porteurReferent: null,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            id: expect.any(String),
            inseeCode: code,
          })),
        ),
      });
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
      const createDto: CreateProjectDto = {
        nom: "Test Project",
        description: "Test Description",
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };

      const createdProject = await service.create(createDto);
      const result = await service.findOne(createdProject.id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { communeInseeCodes, ...expectedFields } = createDto;
      expect(result).toEqual({
        ...expectedFields,
        porteurReferent: null,
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            id: expect.any(String),
            inseeCode: code,
          })),
        ),
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(service.findOne(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(nonExistentId)).rejects.toThrow(
        `Project with ID ${nonExistentId} not found`,
      );
    });
  });
});
