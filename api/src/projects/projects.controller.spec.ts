import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { CreateProjectRequest } from "./dto/create-project.dto";
import { ProjectResponse } from "./dto/project.dto";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { AppModule } from "@/app.module";
import { NotFoundException } from "@nestjs/common";
import { mockRequest } from "@test/mocks/mockRequest";
import { CreateProjectsService } from "@projects/services/create-projects/create-projects.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";
import { CollectiviteReference } from "@projects/dto/collectivite.dto";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let projectCreateService: CreateProjectsService;
  let projectFindService: GetProjectsService;
  let app: TestingModule;

  const mockedCollectivites: CollectiviteReference[] = [{ type: "Commune", code: "01001" }];

  const expectedProject: ProjectResponse = {
    id: "test-id",
    createdAt: new Date(),
    updatedAt: new Date(),
    nom: "Test Project",
    description: "Test Description",
    porteurCodeSiret: "12345678901234",
    porteurReferentEmail: "test@example.com",
    porteurReferentTelephone: null,
    porteurReferentNom: null,
    porteurReferentFonction: null,
    porteurReferentPrenom: null,
    budget: 100000,
    forecastedStartDate: getFormattedDate(),
    status: "IDEE",
    competences: null,
    leviers: null,
    collectivites: mockedCollectivites.map(({ code }) => ({
      codeInsee: code,
      codeEpci: null,
      type: "Commune",
      siren: null,
      codeDepartements: null,
      codeRegions: null,
      nom: "Commune 1",
      id: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    })),
    tetId: null,
    mecId: null,
    recocoId: null,
  };

  beforeEach(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = app.get<ProjectsController>(ProjectsController);
    projectCreateService = app.get<CreateProjectsService>(CreateProjectsService);
    projectFindService = app.get<GetProjectsService>(GetProjectsService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("create", () => {
    const validProject: CreateProjectRequest = {
      nom: "Test Project",
      description: "Test Description",
      porteurCodeSiret: "12345678901234",
      porteurReferentEmail: "test@example.com",
      budget: 100000,
      forecastedStartDate: getFormattedDate(),
      status: "IDEE",
      collectivites: mockedCollectivites,
      externalId: "test-service-id",
    };

    it("should create a new project", async () => {
      const expectedResponse = { id: "test-id" };
      jest.spyOn(projectCreateService, "create").mockResolvedValue(expectedResponse);

      const result = await controller.create(mockRequest("MEC"), validProject);

      expect(result).toEqual(expectedResponse);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(projectCreateService.create).toHaveBeenCalledWith(validProject, "MEC_test_api_key");
    });
  });

  describe("findAll", () => {
    it("should return an array of projects", async () => {
      const expectedProjects: ProjectResponse[] = [expectedProject];

      jest.spyOn(projectFindService, "findAll").mockResolvedValue(expectedProjects);

      const result = await controller.findAll();
      expect(result).toEqual(expectedProjects);
    });
  });

  describe("findOne", () => {
    it("should return a single project", async () => {
      jest.spyOn(projectFindService, "findOne").mockResolvedValue(expectedProject);

      const result = await controller.findOne({ id: crypto.randomUUID() });
      expect(result).toEqual(expectedProject);
    });

    it("should throw NotFoundException for non-existent project", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      jest.spyOn(projectFindService, "findOne").mockRejectedValue(new NotFoundException());

      await expect(controller.findOne({ id: nonExistentId })).rejects.toThrow(NotFoundException);
    });
  });
});
