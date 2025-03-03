/* eslint-disable @typescript-eslint/no-unused-vars */

import { getFormattedDate } from "./helpers/get-formatted-date";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { createApiClient } from "@test/helpers/api-client";
import { Competence, Levier } from "@/shared/types";
import { mockedDefaultCollectivite, mockProjectPayload } from "@test/mocks/mockProjectPayload";
import { collectivites } from "@database/schema";

describe("Projects (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY!);

  afterEach(async () => {
    await global.testDbService.cleanDatabase();
  });
  const validProject = mockProjectPayload();

  beforeEach(async () => {
    await global.testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune 1",
    });
  });

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
      const { data, error } = await tetClient.projects.create({
        ...validProject,
        status: "IDEE",
        externalId: "TeT-service-id",
      });

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProject } = await api.projects.getOne(data!.id);

      expect(updatedProject).toMatchObject({
        tetId: "TeT-service-id",
      });
    });

    it("should create a valid project with Recoco api key", async () => {
      const recocoClient = createApiClient(process.env.RECOCO_API_KEY!);

      const { data, error } = await recocoClient.projects.create({
        ...validProject,
        externalId: "Recoco-service-id",
      });
      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProject } = await api.projects.getOne(data!.id);

      expect(updatedProject).toMatchObject({
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        recocoId: "Recoco-service-id",
      });
    });

    it("should reject when nom is empty", async () => {
      const { error } = await api.projects.create({
        ...validProject,
        nom: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("nom should not be empty");
    });

    it("should reject when externalId is empty", async () => {
      const { error } = await api.projects.create({
        ...validProject,
        externalId: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("externalId should not be empty");
    });

    it("should reject when required fields are missing", async () => {
      const { error } = await api.projects.create({
        nom: "Test Project",
      } as CreateProjectRequest);

      expect(error?.statusCode).toBe(400);
    });

    it("should reject when date is not an isoDate string", async () => {
      const { error } = await api.projects.create({
        ...validProject,
        forecastedStartDate: "hello",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toStrictEqual(["forecastedStartDate must be a valid ISO 8601 date string"]);
    });

    it("should reject when project has no collectivtes", async () => {
      const { error } = await api.projects.create({
        ...validProject,
        collectivitesRef: [],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("At least one commune insee code must be provided");
    });

    it("should reject when project has wrong competences", async () => {
      const { error } = await api.projects.create({
        ...validProject,
        competences: ["Wrong_Competence" as Competence],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "each value in competences must be one of the following values: Autres interventions de protection civile",
      );
    });

    it("should reject when project has wrong leviers", async () => {
      const { error } = await api.projects.create({
        ...validProject,
        leviers: ["WrongLevier" as Levier],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "each value in leviers must be one of the following values: Gestion des forêts et produits bois, Changements de pratiques de fertilisation azotée,",
      );
    });
  });

  describe("POST /projects/bulk", () => {
    const validProjects: { projects: CreateProjectRequest[] } = {
      projects: [
        mockProjectPayload({ externalId: "bulk-project-1" }),
        mockProjectPayload({ externalId: "bulk-project-2" }),
      ],
    };

    it("should reject when wrong api key", async () => {
      const wrongApiClient = createApiClient("wrong-api-key");
      const { error } = await wrongApiClient.projects.createBulk(validProjects);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should create multiple valid projects with MEC api key", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projects.createBulk(validProjects);

      expect(error).toBeUndefined();
      expect(data?.ids).toHaveLength(2);

      // Verify each created project
      for (const id of data!.ids) {
        const { data: project } = await mecClient.projects.getOne(id);
        expect(project).toBeDefined();
        expect(project?.id).toBe(id);
      }
    });

    it("should reject when any project in bulk request is invalid", async () => {
      const invalidProjects = {
        projects: [
          {
            ...mockProjectPayload(),
            nom: "", // Invalid: empty name
          },
          {
            ...mockProjectPayload(),
            nom: "",
          },
        ] as CreateProjectRequest[],
      };

      const { error } = await api.projects.createBulk(invalidProjects);

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toStrictEqual([
        "projects.0.nom should not be empty",
        "projects.1.nom should not be empty",
      ]);
    });

    it("should reject when projects array is empty", async () => {
      const { error } = await api.projects.createBulk({ projects: [] });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("At least one project must be provided");
    });

    it("should rollback all changes if any project creation fails", async () => {
      const projectsWithInvalidBudget = {
        projects: [
          {
            nom: "Valid Project",
            description: "Valid Description",
            budget: 100000,
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
          },
          {
            nom: "Invalid Project",
            description: "Invalid Description",
            budget: "hello", // Invalid budget
            forecastedStartDate: getFormattedDate(),
            status: "IDEE",
          },
        ] as CreateProjectRequest[],
      };

      const { error } = await api.projects.createBulk(projectsWithInvalidBudget);
      expect(error?.statusCode).toBe(400);

      // Verify no projects were created
      const { data: allProjects } = await api.projects.getAll();
      const matchingProjects = allProjects?.filter((p) => p.nom === "Valid Project" || p.nom === "Invalid Project");
      expect(matchingProjects).toHaveLength(0);
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
        externalId: validProject.externalId,
      };

      const { data, error } = await api.projects.update(projectId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projectId,
      });

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
        porteurReferentEmail: "new.referent@email.com",
        externalId: validProject.externalId,
      };

      const { data, error } = await api.projects.update(projectId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projectId,
      });

      const { data: updatedProject } = await api.projects.getOne(projectId);

      const { externalId, ...expectedFields } = updateData;

      expect(updatedProject).toMatchObject({
        ...expectedFields,
        id: projectId,
        mecId: validProject.externalId,
        recocoId: null,
        tetId: null,
      });
    });

    it("should reject update when nom is empty", async () => {
      const { error } = await api.projects.update(projectId, {
        ...validProject,
        nom: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("nom should not be empty");
    });
  });

  describe("GET /projects/:id", () => {
    it("should return a specific project", async () => {
      const { data: createdProject, error: _createError } = await api.projects.create(validProject);

      const projectId = createdProject!.id;

      const { data, error } = await api.projects.getOne(projectId);

      const { externalId, collectivitesRef, ...expectedFields } = validProject;

      expect(error).toBeUndefined();
      expect(data).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        ...expectedFields,
        porteurCodeSiret: null,
        porteurReferentFonction: null,
        porteurReferentEmail: null, // Should be removed
        porteurReferentNom: null,
        porteurReferentPrenom: null,
        porteurReferentTelephone: null,
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        leviers: ["Bio-carburants"],
        status: "IDEE",
        mecId: "test-external-id",
        recocoId: null,
        tetId: null,
        collectivites: [
          {
            codeInsee: mockedDefaultCollectivite.code,
            codeEpci: null,
            type: mockedDefaultCollectivite.type,
            siren: null,
            codeDepartements: null,
            codeRegions: null,
            nom: "Commune 1",
            id: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        ],
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
            collectivites: expect.arrayContaining([
              expect.objectContaining({
                inseeCode: mockedDefaultCollectivite.code,
                type: mockedDefaultCollectivite.type,
              }),
            ]),
          }),
        ]),
      );
    });
  });
});
