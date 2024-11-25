import { ProjectsService } from "./projects.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateProjectDto } from "./dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { hashEmail } from "@projects/utils";
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
        porteurEmail: "porteurEmail@beta.gouv.fr",
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };

      const result = await service.create(createDto);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { porteurEmail, ...expectedFields } = createDto;

      expect(result).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        ...expectedFields,
        porteurEmailHash: hashEmail(createDto.porteurEmail),
      });
    });
  });

  describe("findAll", () => {
    it("should return all projects", async () => {
      const futureDate = getFutureDate();
      const createDto1: CreateProjectDto = {
        nom: "Project 1",
        description: "Description 1",
        porteurEmail: "porteurEmail1@beta.gouv.fr",
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: futureDate,
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };
      const createDto2: CreateProjectDto = {
        nom: "Project 2",
        description: "Description 2",
        porteurEmail: "porteurEmail2@beta.gouv.fr",
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: futureDate,
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };

      await service.create(createDto1);
      await service.create(createDto2);

      const result = await service.findAll();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { porteurEmail: porteurEmail1, ...expectedFieldsDto1 } = createDto1;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { porteurEmail: porteurEmail2, ...expectedFieldsDto2 } = createDto2;

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsDto1,
        porteurEmailHash: hashEmail(createDto1.porteurEmail),
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result[1]).toEqual({
        ...expectedFieldsDto2,
        porteurEmailHash: hashEmail(createDto2.porteurEmail),
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
      const createDto: CreateProjectDto = {
        nom: "Test Project",
        description: "Test Description",
        porteurEmail: "porteurEmail@beta.gouv.fr",
        codeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
        communeInseeCodes: mockedCommunes,
      };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { porteurEmail, ...expectedFields } = createDto;

      const createdProject = await service.create(createDto);
      const result = await service.findOne(createdProject.id);

      expect(result).toEqual({
        ...expectedFields,
        porteurEmailHash: hashEmail(createDto.porteurEmail),
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      const nonExistentId = "non-existent-id";

      await expect(service.findOne(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(nonExistentId)).rejects.toThrow(
        `Project with ID ${nonExistentId} not found`,
      );
    });
  });
});
