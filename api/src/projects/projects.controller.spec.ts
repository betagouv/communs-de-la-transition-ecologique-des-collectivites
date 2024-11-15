import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ConfigModule } from "@nestjs/config";
import { DATABASE } from "../database/database.module";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [ProjectsController],
      providers: [
        ProjectsService,
        {
          provide: DATABASE,
          useValue: {
            select: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = app.get<ProjectsController>(ProjectsController);
    projectsService = app.get<ProjectsService>(ProjectsService);
  });

  describe("create", () => {
    it("should create a new project", async () => {
      const createProjectDto: CreateProjectDto = {
        name: "Test Project",
        description: "Test Description",
        ownerUserId: "user1",
      };

      const expectedProject = {
        id: "generated-id",
        createdAt: new Date(),
        ...createProjectDto,
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
          id: "1",
          name: "Project 1",
          description: "Description 1",
          ownerUserId: "user1",
          createdAt: new Date(),
        },
        {
          id: "2",
          name: "Project 2",
          description: "Description 2",
          ownerUserId: "user1",
          createdAt: new Date(),
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
        id: "1",
        name: "Project 1",
        description: "Description 1",
        ownerUserId: "user1",
        createdAt: new Date(),
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
