import { ProjectsService } from "./projects.service";
import { TestDatabaseService } from "../../test/helpers/test-database.service";

import { CreateProjectDto } from "./dto/create-project.dto";
import { teardownTestModule, testModule } from "../../test/helpers/testModule";
import { TestingModule } from "@nestjs/testing";

describe("ProjectsService", () => {
  let service: ProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

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
        name: "Test Project",
        description: "Test Description",
        ownerUserId: "user1",
      };

      const result = await service.create(createDto);

      expect(result).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        ...createDto,
      });
    });
  });

  describe("findAll", () => {
    it("should return all projects", async () => {
      const createDto1: CreateProjectDto = {
        name: "Project 1",
        description: "Description 1",
        ownerUserId: "user1",
      };
      const createDto2: CreateProjectDto = {
        name: "Project 2",
        description: "Description 2",
        ownerUserId: "user2",
      };

      await service.create(createDto1);
      await service.create(createDto2);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject(createDto1);
      expect(result[1]).toMatchObject(createDto2);
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
      const createDto: CreateProjectDto = {
        name: "Test Project",
        description: "Test Description",
        ownerUserId: "user1",
      };

      const createdProject = await service.create(createDto);
      const result = await service.findOne(createdProject.id);

      expect(result).toMatchObject(createDto);
    });

    it("should return null when project not found", async () => {
      const result = await service.findOne("non-existent-id");
      expect(result).toBeNull();
    });
  });
});
