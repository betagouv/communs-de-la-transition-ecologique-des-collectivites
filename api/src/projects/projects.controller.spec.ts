import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { AppModule } from "@/app.module";
import { afterEach } from "node:test";
import { ProjectStatus } from "@/database/schema";
import { ProjectDto } from "./dto/project.dto";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = app.get<ProjectsController>(ProjectsController);
    projectsService = app.get<ProjectsService>(ProjectsService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("create", () => {
    it("should create a new project", async () => {
      const createProjectDto: CreateProjectDto = {
        nom: "Test Project",
        description: "Test Description",
        codeSiret: "12345678901234",
        porteurEmail: "test@example.com",
        budget: 100000,
        forecastedStartDate: "2025-01-01",
        status: "DRAFT" as keyof typeof ProjectStatus,
        communeInseeCodes: ["75056"],
      };

      const expectedProject: ProjectDto = {
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...createProjectDto,
        porteurEmailHash: expect.any(String), // Hash will be generated
        communeInseeCodes: ["75056"],
      };

      jest.spyOn(projectsService, "create").mockResolvedValue(expectedProject);

      const result = await controller.create(createProjectDto);

      expect(result).toEqual(expectedProject);
      expect(projectsService.create).toHaveBeenCalledWith(createProjectDto);
    });
  });

  describe("findAll", () => {
    it("should return an array of projects", async () => {
      const expectedProjects = [
        {
          id: "test-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          nom: "Test Project",
          description: "Test Description",
          codeSiret: "12345678901234",
          porteurEmailHash: "hashed-email",
          budget: 100000,
          forecastedStartDate: "2024-01-01",
          status: ProjectStatus.DRAFT,
          communeInseeCodes: ["75056"],
        },
      ];

      jest
        .spyOn(projectsService, "findAll")
        .mockResolvedValue(expectedProjects);

      const result = await controller.findAll();
      expect(result).toEqual(expectedProjects);
    });
  });

  describe("findOne", () => {
    it("should return a single project", async () => {
      const expectedProject = {
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        nom: "Test Project",
        description: "Test Description",
        codeSiret: "12345678901234",
        porteurEmailHash: "hashed-email",
        budget: 100000,
        forecastedStartDate: "2024-01-01",
        status: ProjectStatus.DRAFT,
        communeInseeCodes: ["75056"],
      };

      jest.spyOn(projectsService, "findOne").mockResolvedValue(expectedProject);

      const result = await controller.findOne("1");
      expect(result).toEqual(expectedProject);
    });

    it("should return null for non-existent project", async () => {
      jest.spyOn(projectsService, "findOne").mockResolvedValue(null);

      const result = await controller.findOne("999");
      expect(result).toBeNull();
    });
  });
});
