import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { UpdateProjectsService } from "./update-projects.service";
import { CreateProjectsService } from "../create-projects/create-projects.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";
import { CompetenceWithSousCompetence } from "@/shared/types";

describe("ProjectUpdateService", () => {
  let updateService: UpdateProjectsService;
  let createService: CreateProjectsService;
  let findService: GetProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let projectId: string;

  const mockedCommunes = ["01001", "75056", "97A01"];
  const MEC_API_KEY = "MEC_test_api_key";
  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    updateService = module.get<UpdateProjectsService>(UpdateProjectsService);
    createService = module.get<CreateProjectsService>(CreateProjectsService);
    findService = module.get<GetProjectsService>(GetProjectsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    const createDto: CreateProjectRequest = {
      nom: "Initial Project",
      description: "Initial Description",
      porteurReferentEmail: "initial@email.com",
      budget: 100000,
      forecastedStartDate: getFormattedDate(),
      status: "IDEE",
      communeInseeCodes: mockedCommunes,
      serviceId: "test-service-id",
    };

    const result = await createService.create(createDto, MEC_API_KEY);
    projectId = result.id;
  });

  it("should update basic project fields", async () => {
    const updateDto = {
      nom: "Updated Project",
      description: "Updated Description",
      budget: 200000,
      serviceId: "test-service-id-1",
    };

    await updateService.update(projectId, updateDto, MEC_API_KEY);
    const updatedProject = await findService.findOne(projectId);
    const { serviceId, ...expectedfields } = updateDto;
    expect(updatedProject).toMatchObject({
      ...expectedfields,
      id: projectId,
      porteurReferentEmail: "initial@email.com",
      communes: expect.arrayContaining(
        mockedCommunes.map((code) => ({
          inseeCode: code,
        })),
      ),
    });
  });

  it("should update competences and sous-competences properly", async () => {
    const updateDto = {
      nom: "Updated Project",
      description: "Updated Description",
      competencesAndSousCompetences: [
        "Santé",
        "Culture__Arts plastiques et photographie",
      ] as CompetenceWithSousCompetence[],
      budget: 200000,
      serviceId: "test-service-id-2",
    };

    const { serviceId, ...expectedFields } = updateDto;

    await updateService.update(projectId, updateDto, MEC_API_KEY);
    const updatedProject = await findService.findOne(projectId);

    expect(updatedProject).toMatchObject({
      ...expectedFields,
      id: projectId,
      porteurReferentEmail: "initial@email.com",
      competencesAndSousCompetences: ["Santé", "Culture__Arts plastiques et photographie"],
    });
  });

  it("should only update communes when this is the only change", async () => {
    const newCommunes = ["34567", "89012"];
    const updateDto = {
      communeInseeCodes: newCommunes,
      serviceId: "test-service-id-3",
    };

    await updateService.update(projectId, updateDto, MEC_API_KEY);
    const updatedProject = await findService.findOne(projectId);

    expect(updatedProject.communes).toHaveLength(newCommunes.length);
    expect(updatedProject.communes).toEqual(
      expect.arrayContaining(
        newCommunes.map((code) => ({
          inseeCode: code,
        })),
      ),
    );
  });

  it("should throw NotFoundException when project doesn't exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateDto = { nom: "Updated Name", serviceId: "test-service-id-4" };

    await expect(updateService.update(nonExistentId, updateDto, "MEC_test_api_key")).rejects.toThrow(NotFoundException);
    await expect(updateService.update(nonExistentId, updateDto, "MEC_test_api_key")).rejects.toThrow(
      `Project with ID ${nonExistentId} not found`,
    );
  });
});
