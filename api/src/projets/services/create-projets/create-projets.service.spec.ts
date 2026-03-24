import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestingModule } from "@nestjs/testing";
import { CreateProjetsService } from "./create-projets.service";
import { collectivites, projets, projetsToCollectivites } from "@database/schema";
import { and, eq, inArray } from "drizzle-orm";
import { BulkCreateProjetsRequest } from "@projets/dto/bulk-create-projets.dto";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { PROJECT_QUALIFICATION_CLASSIFICATION_JOB } from "@/projet-qualification/const";

describe("ProjectCreateService", () => {
  let service: CreateProjetsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    service = module.get<CreateProjetsService>(CreateProjetsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 10000);

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    await testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune 1",
    });
  });

  describe("create", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should create a new project", async () => {
      const createDto = mockProjetPayload();

      const result = await service.create(createDto, process.env.MEC_API_KEY!);

      expect(result).toEqual({
        id: expect.any(String),
      });
    });

    it("should update a project if it is an existing one", async () => {
      const createDto = mockProjetPayload();

      const createdProject = await service.create(createDto, process.env.MEC_API_KEY!);
      await service.create({ ...createDto, nom: "Updated Project" }, process.env.MEC_API_KEY!);

      expect(createdProject).toEqual({
        id: expect.any(String),
      });

      const [updatedProject] = await testDbService.database
        .select()
        .from(projets)
        .where(eq(projets.id, createdProject.id));

      expect(updatedProject).toMatchObject({
        nom: "Updated Project",
        id: createdProject.id,
      });
    });

    it("should allow same externalId for different services", async () => {
      const createDto = mockProjetPayload();

      // Create project with MEC API key
      await service.create(createDto, process.env.MEC_API_KEY!);

      // Should succeed with TET API key
      await expect(service.create(createDto, process.env.TET_API_KEY!)).resolves.toEqual({
        id: expect.any(String),
      });
    });

    it("should not trigger a qualification job when competences are  already filled in", async () => {
      const createDto = mockProjetPayload();
      await service.create(createDto, process.env.MEC_API_KEY!);

      const spyOnSchedule = jest.spyOn(service as any, "scheduleProjectQualification");

      await service.create({ ...createDto, budgetPrevisionnel: 10000 }, process.env.MEC_API_KEY!);

      expect(spyOnSchedule).not.toHaveBeenCalled();
    });

    it("should trigger a qualification job when competences are not already filled in", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { competences, ...restOfProject } = mockProjetPayload();
      await service.create(restOfProject, process.env.MEC_API_KEY!);

      const spyOnSchedule = jest.spyOn(service as any, "scheduleProjectQualification");

      await service.create({ ...restOfProject, budgetPrevisionnel: 10000 }, process.env.MEC_API_KEY!);

      expect(spyOnSchedule).toHaveBeenCalled();
    });

    it("should store contentHash on project creation", async () => {
      const createDto = mockProjetPayload();
      const result = await service.create(createDto, process.env.MEC_API_KEY!);

      const [project] = await testDbService.database
        .select({ contentHash: projets.contentHash })
        .from(projets)
        .where(eq(projets.id, result.id))
        .limit(1);

      expect(project.contentHash).toBeTruthy();
      expect(project.contentHash).toHaveLength(64); // SHA256 hex string
    });

    it("should trigger reclassification on upsert when content changes", async () => {
      const createDto = mockProjetPayload();
      await service.create(createDto, process.env.MEC_API_KEY!);

      const spyOnSchedule = jest.spyOn(service as any, "scheduleProjectQualification");

      // Upsert with different nom → content hash changes → should trigger classification
      await service.create({ ...createDto, nom: "Titre complètement différent" }, process.env.MEC_API_KEY!);

      expect(spyOnSchedule).toHaveBeenCalledWith(expect.any(String), PROJECT_QUALIFICATION_CLASSIFICATION_JOB);
    });

    it("should not trigger reclassification on upsert when content is unchanged", async () => {
      const createDto = mockProjetPayload();
      await service.create(createDto, process.env.MEC_API_KEY!);

      const spyOnSchedule = jest.spyOn(service as any, "scheduleProjectQualification");

      // Upsert with only budget change → content hash same → no reclassification
      await service.create({ ...createDto, budgetPrevisionnel: 999999 }, process.env.MEC_API_KEY!);

      expect(spyOnSchedule).not.toHaveBeenCalled();
    });
  });

  describe("createBulk", () => {
    it("should create multiple projects in a transaction", async () => {
      const projectsToCreate: BulkCreateProjetsRequest = {
        projets: [mockProjetPayload(), mockProjetPayload({ nom: "Test Project 2", externalId: "test-external-id-2" })],
      };

      const result = await service.createBulk(projectsToCreate, process.env.MEC_API_KEY!);

      expect(result.ids).toHaveLength(2);

      // Verify projects were created
      const createdProjects = await testDbService.database
        .select()
        .from(projets)
        .where(inArray(projets.id, result.ids));

      expect(createdProjects).toHaveLength(2);

      // Verify collectivites were created and linked
      const projectCollectivites = await testDbService.database
        .select()
        .from(projetsToCollectivites)
        .where(
          and(
            inArray(
              projetsToCollectivites.projetId,
              createdProjects.map((p) => p.id),
            ),
          ),
        );

      expect(projectCollectivites).toHaveLength(2);
    });
  });
});
