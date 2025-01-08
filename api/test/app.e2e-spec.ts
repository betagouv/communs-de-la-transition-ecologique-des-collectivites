import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";
import { e2eTestDbSetup } from "./helpers/e2eTestDbSetup";
import { e2eTearDownSetup } from "./helpers/e2eTearDownSetup";
import { getFutureDate } from "./helpers/getFutureDate";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { createApiClient } from "@test/helpers/apiClient";

// This is needed to use expect any syntax
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe("AppController (e2e)", () => {
  let app: INestApplication;
  let api: ReturnType<typeof createApiClient>;

  beforeAll(async () => {
    await e2eTestDbSetup();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    await app.listen(3000);

    api = createApiClient(process.env.MEC_API_KEY!);
  }, 30000);

  afterAll(async () => {
    await app?.close();
    await e2eTearDownSetup();
  });

  describe("Projects (e2e)", () => {
    const validProject: CreateProjectRequest = {
      nom: "Test Project",
      description: "Test Description",
      budget: 100000,
      porteurReferentEmail: "test@email.com",
      porteurCodeSiret: null,
      forecastedStartDate: getFutureDate(),
      status: "IDEE",
      communeInseeCodes: ["01001", "75056", "97A01"],
    };

    describe("POST /projects", () => {
      it("should reject when wrong api key", async () => {
        const wrongApiClient = createApiClient("wrong-api-key");
        const { error } = await wrongApiClient.projects.create(validProject);

        expect(error?.statusCode).toBe(401);
        expect(error?.message).toContain("Invalid API key");
      });

      it("should create a valid project with MEC api key", async () => {
        const mecClient = createApiClient(process.env.MEC_API_KEY!);
        const { data, error } = await mecClient.projects.create(validProject);

        expect(error).toBeUndefined();
        expect(data).toHaveProperty("id");
      });

      it("should create a valid project with TeT api key", async () => {
        const tetClient = createApiClient(process.env.TET_API_KEY!);
        const { data, error } = await tetClient.projects.create({ ...validProject, status: "IDEE" });

        expect(error).toBeUndefined();
        expect(data).toHaveProperty("id");
      });

      it("should create a valid project with Recoco api key", async () => {
        const recocoClient = createApiClient(process.env.RECOCO_API_KEY!);
        const { data, error } = await recocoClient.projects.create(validProject);

        expect(error).toBeUndefined();
        expect(data).toHaveProperty("id");
      });

      it("should reject when nom is empty", async () => {
        const { error } = await api.projects.create({
          ...validProject,
          nom: "",
        });

        expect(error?.statusCode).toBe(400);
        expect(error?.message).toContain("nom should not be empty");
      });

      it("should reject when required fields are missing", async () => {
        const { error } = await api.projects.create({
          nom: "Test Project",
        } as CreateProjectRequest);

        expect(error?.statusCode).toBe(400);
      });

      it("should create a valid project", async () => {
        const { data, error } = await api.projects.create(validProject);

        expect(error).toBeUndefined();
        expect(data).toMatchObject({
          id: expect.any(String),
        });
      });

      it("should reject when date is in the past", async () => {
        const pastDate = new Date();
        pastDate.setFullYear(pastDate.getFullYear() - 1);
        const pastDateStr = pastDate.toISOString().split("T")[0];

        const { error } = await api.projects.create({
          ...validProject,
          forecastedStartDate: pastDateStr,
        });

        expect(error?.statusCode).toBe(400);
        expect(error?.message).toBe("Forecasted start date must be in the future");
      });

      it("should reject when project has no commune insee code", async () => {
        const { error } = await api.projects.create({
          ...validProject,
          communeInseeCodes: [],
        });

        expect(error?.statusCode).toBe(400);
        expect(error?.message[0]).toBe("At least one commune insee code must be provided");
      });
    });

    describe("PATCH /projects/:id", () => {
      let projectId: string;

      beforeEach(async () => {
        const { data } = await api.projects.create(validProject);
        projectId = data!.id;
      });

      it("should update porteur referent email and handle collaborator permissions", async () => {
        const newEmail = "new.referent@email.com";
        const updateData = {
          porteurReferentEmail: newEmail,
        };

        const { data, error } = await api.projects.update(projectId, updateData);

        expect(error).toBeUndefined();
        expect(data).toMatchObject({
          id: projectId,
        });

        // Use new email to verify permissions
        const { data: updatedProject } = await api.projects.getOne(projectId);

        expect(updatedProject).toMatchObject({
          id: projectId,
          porteurReferentEmail: newEmail,
        });
      });

      it("should update multiple fields at once", async () => {
        const updateData = {
          nom: "Updated Project Name",
          description: "Updated Description",
          budget: 200000,
          communeInseeCodes: ["34567", "89012"],
          porteurReferentEmail: "new.referent@email.com",
        };

        const { data, error } = await api.projects.update(projectId, updateData);

        expect(error).toBeUndefined();
        expect(data).toMatchObject({
          id: projectId,
        });

        const { data: updatedProject } = await api.projects.getOne(projectId);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { communeInseeCodes, ...expectedFields } = updateData;

        expect(updatedProject).toMatchObject({
          ...expectedFields,
          id: projectId,
          communes: expect.arrayContaining(
            updateData.communeInseeCodes.map((code) => ({
              inseeCode: code,
            })),
          ),
        });
      });
    });

    describe("GET /projects/:id", () => {
      it("should return a specific project", async () => {
        const { data: createdProject } = await api.projects.create(validProject);
        const projectId = createdProject!.id;

        const { data, error } = await api.projects.getOne(projectId);

        const {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          communeInseeCodes: communeCodesInProject1,
          ...expectedFields
        } = validProject;

        expect(error).toBeUndefined();
        expect(data).toEqual({
          id: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          ...expectedFields,
          porteurCodeSiret: null,
          porteurReferentFonction: null,
          porteurReferentNom: null,
          porteurReferentPrenom: null,
          porteurReferentTelephone: null,
          competences: null,
          sousCompetences: null,
          communes: expect.arrayContaining([
            expect.objectContaining({
              inseeCode: expect.any(String),
            }),
          ]),
          status: "IDEE",
        });
      });

      it("should return 404 for non-existent project", async () => {
        const nonExistentId = "00000000-0000-0000-0000-000000000000";
        const { error } = await api.projects.getOne(nonExistentId);

        expect(error?.statusCode).toBe(404);
      });
    });

    describe("GET /projects", () => {
      it("should return all projects", async () => {
        await api.projects.create(validProject);

        const { data, error } = await api.projects.getAll();

        expect(error).toBeUndefined();
        expect(data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              nom: validProject.nom,
              communes: expect.arrayContaining([
                expect.objectContaining({
                  inseeCode: expect.any(String),
                }),
              ]),
            }),
          ]),
        );
      });
    });
  });
});
