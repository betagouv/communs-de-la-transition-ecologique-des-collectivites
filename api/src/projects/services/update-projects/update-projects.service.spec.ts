/* eslint-disable @typescript-eslint/no-unused-vars */

import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { CreateProjectRequest } from "../../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { getFormattedDate } from "@test/helpers/get-formatted-date";
import { UpdateProjectsService } from "./update-projects.service";
import { CreateProjectsService } from "../create-projects/create-projects.service";
import { GetProjectsService } from "@projects/services/get-projects/get-projects.service";
import { UpdateProjectDto } from "@projects/dto/update-project.dto";
import { CollectiviteReference } from "@projects/dto/collectivite.dto";
import { collectivites } from "@database/schema";

describe("ProjectUpdateService", () => {
  let updateService: UpdateProjectsService;
  let createService: CreateProjectsService;
  let findService: GetProjectsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let projectId: string;

  const MEC_API_KEY = "MEC_test_api_key";
  const EXTERNAL_ID = "test-service-id";
  const mockedCollectivites: CollectiviteReference = { type: "Commune", code: "01001" };

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

    await testDbService.database.insert(collectivites).values({
      type: mockedCollectivites.type,
      codeInsee: mockedCollectivites.code,
      nom: "Commune 1",
    });

    const createDto: CreateProjectRequest = {
      nom: "Initial Project",
      description: "Initial Description",
      porteurReferentEmail: "initial@email.com",
      budget: 100000,
      forecastedStartDate: getFormattedDate(),
      status: "IDEE",
      collectivites: [mockedCollectivites],
      externalId: EXTERNAL_ID,
    };

    const result = await createService.create(createDto, MEC_API_KEY);

    projectId = result.id;
  });

  it("should update basic project fields", async () => {
    const updateDto = {
      nom: "Updated Project",
      description: "Updated Description",
      budget: 200000,
      externalId: EXTERNAL_ID,
    };

    await updateService.update(projectId, updateDto, MEC_API_KEY);
    const updatedProject = await findService.findOne(projectId);
    const { externalId, ...expectedfields } = updateDto;

    expect(updatedProject).toMatchObject({
      ...expectedfields,
      id: projectId,
      porteurReferentEmail: "initial@email.com",

      collectivites: expect.arrayContaining([
        {
          codeInsee: mockedCollectivites.code,
          codeEpci: null,
          type: "Commune",
          siren: null,
          codeDepartements: null,
          codeRegions: null,
          nom: "Commune 1",
          id: expect.any(String),
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      ]),
    });
  });

  it("should update competences properly", async () => {
    const updateDto: UpdateProjectDto = {
      nom: "Updated Project",
      description: "Updated Description",
      competences: ["Santé", "Culture > Arts plastiques et photographie"],
      budget: 200000,
      externalId: EXTERNAL_ID,
    };

    const { externalId, ...expectedFields } = updateDto;

    await updateService.update(projectId, updateDto, MEC_API_KEY);
    const updatedProject = await findService.findOne(projectId);

    expect(updatedProject).toMatchObject({
      ...expectedFields,
      id: projectId,
      porteurReferentEmail: "initial@email.com",
    });
  });

  it("should only update collectivites when this is the only change", async () => {
    const newCollectivite: CollectiviteReference = { code: "new_EPCI", type: "EPCI" };

    await testDbService.database.insert(collectivites).values({
      type: newCollectivite.type,
      codeEpci: newCollectivite.code,
      nom: "new EPCI Collectivite",
    });

    const updateDto: UpdateProjectDto = {
      collectivites: [newCollectivite],
      externalId: EXTERNAL_ID,
    };

    await updateService.update(projectId, updateDto, MEC_API_KEY);
    const updatedProject = await findService.findOne(projectId);

    expect(updatedProject.collectivites).toHaveLength(1);
    expect(updatedProject.collectivites[0]).toMatchObject({
      type: newCollectivite.type,
      codeEpci: newCollectivite.code,
      nom: "new EPCI Collectivite",
    });
  });

  it("should throw NotFoundException when project doesn't exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const updateDto = { nom: "Updated Name", externalId: "test-external-id-4" };

    await expect(updateService.update(nonExistentId, updateDto, "MEC_test_api_key")).rejects.toThrow(NotFoundException);
    await expect(updateService.update(nonExistentId, updateDto, "MEC_test_api_key")).rejects.toThrow(
      `Project with ID ${nonExistentId} not found`,
    );
  });

  it("should throw ConflictException when externalId doesn't match", async () => {
    const updateDto = {
      nom: "Updated Project",
      description: "Updated Description",
      budget: 200000,
      externalId: "different-external-id", // Different from the one used in creation
    };

    await expect(updateService.update(projectId, updateDto, MEC_API_KEY)).rejects.toThrow(
      new ConflictException(
        `Project with ID ${projectId} cannot be updated: externalId mismatch (current: test-service-id, requested: different-external-id)`,
      ),
    );
  });
});
