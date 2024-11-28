import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./services/projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectDto } from "./dto/project.dto";
import { getFutureDate } from "@test/helpers/getFutureDate";
import { AppModule } from "@/app.module";
import { NotFoundException } from "@nestjs/common";

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
    const validProject: CreateProjectDto = {
      nom: "Test Project",
      description: "Test Description",
      codeSiret: "12345678901234",
      porteurReferent: {
        email: "test@example.com",
      },
      budget: 100000,
      forecastedStartDate: getFutureDate(),
      status: "DRAFT",
      communeInseeCodes: ["75056"],
    };

    it("should create a new project", async () => {
      const expectedResponse = { id: "test-id" };
      jest.spyOn(projectsService, "create").mockResolvedValue(expectedResponse);

      const result = await controller.create(validProject);

      expect(result).toEqual(expectedResponse);
      expect(projectsService.create).toHaveBeenCalledWith(validProject);
    });
  });

  describe("findAll", () => {
    it("should return an array of projects", async () => {
      const expectedProjects: ProjectDto[] = [
        {
          id: "test-id",
          createdAt: new Date(),
          updatedAt: new Date(),
          nom: "Test Project",
          description: "Test Description",
          codeSiret: "12345678901234",
          porteurReferent: {
            email: "test@example.com",
            telephone: null,
            prenom: null,
            nom: null,
            fonction: null,
          },
          porteur: null,
          budget: 100000,
          forecastedStartDate: getFutureDate(),
          status: "DRAFT",
          communes: [
            {
              id: expect.any(String),
              inseeCode: "75056",
            },
          ],
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
      const expectedProject: ProjectDto = {
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        nom: "Test Project",
        description: "Test Description",
        codeSiret: "12345678901234",
        porteurReferent: null,
        porteur: null,
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
        communes: [
          {
            id: expect.any(String),
            inseeCode: "75056",
          },
        ],
      };

      jest.spyOn(projectsService, "findOne").mockResolvedValue(expectedProject);

      const result = await controller.findOne("1");
      expect(result).toEqual(expectedProject);
    });

    it("should throw NotFoundException for non-existent project", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      jest
        .spyOn(projectsService, "findOne")
        .mockRejectedValue(new NotFoundException());

      await expect(controller.findOne(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
