// disabled to use expect any syntax
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ProjectsService } from "./projects.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { CreateProjectRequest } from "../dto/create-project.dto";
import { TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { getFutureDate } from "@test/helpers/getFutureDate";
import { projectCollaborators, projects } from "@database/schema";
import { eq } from "drizzle-orm";
import { UpdateProjectDto } from "@projects/dto/update-project.dto";

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
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };

      const result = await service.create(createDto, "MEC");

      expect(result).toEqual({
        id: expect.any(String),
      });
    });

    it("should create a new collaborator permission when project is created", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        porteurReferentEmail: "nouveauPorteur@email.com",
        forecastedStartDate: getFutureDate(),
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };

      const createdProject = await service.create(createDto, "MEC");

      const collaborators = await testDbService.database
        .select()
        .from(projectCollaborators)
        .where(eq(projectCollaborators.projectId, createdProject.id));

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0]).toMatchObject({
        email: createDto.porteurReferentEmail,
        permissionType: "EDIT",
        projectId: createdProject.id,
      });
    });

    it("should mapp the status to a generic one properly", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        porteurReferentEmail: "nouveauPorteur@email.com",
        forecastedStartDate: getFutureDate(),
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };

      const newProject = await service.create(createDto, "MEC");

      const [createdProject] = await testDbService.database
        .select()
        .from(projects)
        .where(eq(projects.id, newProject.id));

      expect(createdProject.status).toEqual("IDEE");
    });
  });

  describe("findAll", () => {
    it("should return all projects", async () => {
      const futureDate = getFutureDate();
      const createDto1: CreateProjectRequest = {
        nom: "Project 1",
        description: "Description 1",
        porteurReferentEmail: "porteurReferentEmail@email.com",
        budget: 100000,
        forecastedStartDate: futureDate,
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };
      const createDto2: CreateProjectRequest = {
        nom: "Project 2",
        description: "Description 2",
        budget: 100000,
        forecastedStartDate: futureDate,
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };

      await service.create(createDto1, "MEC");
      await service.create(createDto2, "MEC");

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

      const expectedCommonFields = {
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        porteurCodeSiret: null,
        porteurReferentEmail: null,
        porteurReferentFonction: null,
        porteurReferentNom: null,
        porteurReferentPrenom: null,
        porteurReferentTelephone: null,
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
      };

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        ...expectedFieldsProject1,
        ...expectedCommonFields,
        porteurReferentEmail: "porteurReferentEmail@email.com",
        status: "IDEE",
      });

      expect(result[1]).toEqual({
        ...expectedFieldsProject2,
        ...expectedCommonFields,
        status: "IDEE",
      });
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
      const createDto: CreateProjectRequest = {
        nom: "Test Project",
        description: "Test Description",
        porteurCodeSiret: "12345678901234",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };

      const createdProject = await service.create(createDto, "MEC");
      const result = await service.findOne(createdProject.id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { communeInseeCodes, ...expectedFields } = createDto;
      expect(result).toEqual({
        ...expectedFields,
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
        porteurReferentEmail: null,
        porteurReferentFonction: null,
        porteurReferentNom: null,
        porteurReferentPrenom: null,
        porteurReferentTelephone: null,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        status: "IDEE",
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      await expect(service.findOne(nonExistentId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(nonExistentId)).rejects.toThrow(`Project with ID ${nonExistentId} not found`);
    });
  });

  describe("update", () => {
    let projectId: string;

    beforeEach(async () => {
      const createDto: CreateProjectRequest = {
        nom: "Initial Project",
        description: "Initial Description",
        porteurReferentEmail: "initial@email.com",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "Non démarré, intention",
        communeInseeCodes: mockedCommunes,
      };

      const result = await service.create(createDto, "MEC");
      projectId = result.id;
    });

    it("should update basic project fields", async () => {
      const updateDto = {
        nom: "Updated Project",
        description: "Updated Description",
        budget: 200000,
      };

      await service.update(projectId, updateDto, "MEC");

      const updatedProject = await service.findOne(projectId);

      expect(updatedProject).toMatchObject({
        ...updateDto,
        id: projectId,
        porteurReferentEmail: "initial@email.com",
        communes: expect.arrayContaining(
          mockedCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
      });
    });

    it("should only update communes when this is the only change", async () => {
      const newCommunes = ["34567", "89012"];
      const updateDto: UpdateProjectDto = {
        communeInseeCodes: newCommunes,
      };

      await service.update(projectId, updateDto, "MEC");
      const updatedProject = await service.findOne(projectId);

      expect(updatedProject.communes).toHaveLength(newCommunes.length);
      expect(updatedProject.communes).toEqual(
        expect.arrayContaining(
          newCommunes.map((code) => ({
            inseeCode: code,
          })),
        ),
      );
    });

    it("should update collaborator when porteurReferentEmail changes", async () => {
      const updateDto = {
        porteurReferentEmail: "new@email.com",
      };

      await service.update(projectId, updateDto, "MEC");
      const project = await service.findOne(projectId);
      expect(project.porteurReferentEmail).toBe(updateDto.porteurReferentEmail);

      const collaborators = await testDbService.database
        .select()
        .from(projectCollaborators)
        .where(eq(projectCollaborators.projectId, projectId));

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0]).toMatchObject({
        email: updateDto.porteurReferentEmail,
        permissionType: "EDIT",
      });

      // Verify old collaborator was removed
      const oldCollaborator = collaborators.find((c) => c.email === "initial@email.com");
      expect(oldCollaborator).toBeUndefined();
    });

    it("should throw NotFoundException when project doesn't exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const updateDto = { nom: "Updated Name" };

      await expect(service.update(nonExistentId, updateDto, "MEC")).rejects.toThrow(NotFoundException);
      await expect(service.update(nonExistentId, updateDto, "MEC")).rejects.toThrow(
        `Project with ID ${nonExistentId} not found`,
      );
    });

    it("should validate forecasted start date", async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const updateDto = {
        forecastedStartDate: pastDate.toISOString().split("T")[0],
      };

      await expect(service.update(projectId, updateDto, "MEC")).rejects.toThrow(
        "Forecasted start date must be in the future",
      );
    });
  });
});
