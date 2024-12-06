import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";
import { e2eTestDbSetup } from "./helpers/e2eTestDbSetup";
import { e2eTearDownSetup } from "./helpers/e2eTearDownSetup";
import { getFutureDate } from "./helpers/getFutureDate";
import { createApiClient } from "./helpers/apiClient";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { CreateCollaboratorRequest } from "@/collaborators/dto/create-collaborator.dto";

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

    api = createApiClient(process.env.API_KEY);
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
      forecastedStartDate: getFutureDate(),
      status: "DRAFT",
      communeInseeCodes: ["01001", "75056", "97A01"],
    };

    describe("POST /projects", () => {
      it("should reject when wrong api key", async () => {
        const wrongApiClient = createApiClient(`wrong-${process.env.API_KEY}`);
        const { error } = await wrongApiClient.projects.create(validProject);

        expect(error.statusCode).toBe(401);
        expect(error.message).toContain("Invalid API key");
      });

      it("should reject when nom is empty", async () => {
        const { error } = await api.projects.create({
          ...validProject,
          nom: "",
        });

        expect(error.statusCode).toBe(400);
        expect(error.message).toContain("nom should not be empty");
      });

      it("should reject when required fields are missing", async () => {
        const { error } = await api.projects.create({
          nom: "Test Project",
        } as CreateProjectRequest);

        expect(error.statusCode).toBe(400);
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
        expect(error?.message).toBe(
          "Forecasted start date must be in the future",
        );
      });
    });

    describe("GET /projects/:id", () => {
      it("should return a specific project", async () => {
        const { data: createdProject } =
          await api.projects.create(validProject);
        const projectId = createdProject.id;

        const { data, error } = await api.projects.getOne(
          projectId,
          "test@email.com",
        );

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
          communes: expect.arrayContaining([
            expect.objectContaining({
              inseeCode: expect.any(String),
            }),
          ]),
        });
      });

      it("should not allow to get project when user email is not provided", async () => {
        const { data: createdProject } =
          await api.projects.create(validProject);
        const projectId = createdProject.id;

        const { error } = await api.projects.getOne(projectId); // No email provided

        expect(error.statusCode).toBe(400);
        expect(error.message).toBe("Missing user email in x-user-email header");
      });

      it("should not allow to get project when user has no corresponding permission", async () => {
        const { data: createdProject } =
          await api.projects.create(validProject);
        const projectId = createdProject.id;

        const { error } = await api.projects.getOne(
          projectId,
          "no-permission@email.com",
        );

        expect(error.statusCode).toBe(403);
        expect(error.message).toBe("Insufficient permissions");
      });

      it("should return 404 for non-existent project", async () => {
        const nonExistentId = "00000000-0000-0000-0000-000000000000";
        const { error } = await api.projects.getOne(
          nonExistentId,
          "test@email.com",
        );

        expect(error.statusCode).toBe(404);
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

  describe("Collaborators (e2e)", () => {
    let projectId: string;
    const validProject: CreateProjectRequest = {
      nom: "Collaboration Test Project",
      description: "Test Description",
      budget: 100000,
      forecastedStartDate: getFutureDate(),
      porteurReferentEmail: "owner@email.com",
      status: "DRAFT",
      communeInseeCodes: ["01001"],
    };

    const validCollaborator: CreateCollaboratorRequest = {
      email: "collaborator@email.com",
      permissionType: "VIEW",
    };

    beforeAll(async () => {
      const { data } = await api.projects.create(validProject);
      projectId = data.id;
    });

    describe("POST /projects/:id/update-collaborators", () => {
      it("should add a collaborator with VIEW permission", async () => {
        const { data, error } = await api.collaborators.create(
          projectId,
          validCollaborator,
        );

        expect(error).toBeUndefined();
        expect(data).toMatchObject({
          projectId,
          email: validCollaborator.email,
          permissionType: validCollaborator.permissionType,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      });

      it("should update existing collaborator permission", async () => {
        const updatedCollaborator: CreateCollaboratorRequest = {
          ...validCollaborator,
          permissionType: "EDIT",
        };

        const { data, error } = await api.collaborators.create(
          projectId,
          updatedCollaborator,
        );

        expect(error).toBeUndefined();
        expect(data).toMatchObject({
          projectId,
          email: updatedCollaborator.email,
          permissionType: updatedCollaborator.permissionType,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        });
      });
    });
  });
});
