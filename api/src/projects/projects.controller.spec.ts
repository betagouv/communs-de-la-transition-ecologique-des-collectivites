import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ConfigModule } from "@nestjs/config";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;
  let app: TestingModule;

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [ProjectsController],
      providers: [ProjectsService, PrismaService],
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

    it("should pass through service errors", async () => {
      const createProjectDto: CreateProjectDto = {
        name: "Test Project",
        description: "Test Description",
        ownerUserId: "user1",
      };

      jest
        .spyOn(projectsService, "create")
        .mockRejectedValue(new Error("Creation failed"));

      await expect(controller.create(createProjectDto)).rejects.toThrow(
        "Creation failed",
      );
    });
  });
});
