/* eslint-disable @typescript-eslint/no-unused-vars */

import { getFormattedDate } from "./helpers/get-formatted-date";
import { createApiClient } from "@test/helpers/api-client";
import { Competence, Levier } from "@/shared/types";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { collectivites, PhaseStatut, ProjetPhases } from "@database/schema";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";

describe("Projets (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY!);

  afterEach(async () => {
    await global.testDbService.cleanDatabase();
  });
  const validProjet = mockProjetPayload();

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
      const { error } = await wrongApiClient.projects.create(validProjet);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should create a project with minimal fields", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);

      const minimalProjet: CreateProjetRequest = {
        nom: "minimalProjet",
        description: "minimalProjet Description",
        externalId: "minimalProjet-externalId",
        collectivites: [{ type: mockedDefaultCollectivite.type, code: mockedDefaultCollectivite.code }],
      };
      const { data, error } = await mecClient.projects.create(minimalProjet);

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");
    });

    it("should create a valid project with MEC api key", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projects.create(validProjet);

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");
    });

    it("should create a valid project with TeT api key", async () => {
      const tetClient = createApiClient(process.env.TET_API_KEY!);
      const { data, error } = await tetClient.projects.create({
        ...validProjet,
        phase: "Idée",
        externalId: "TeT-service-id",
      });

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProjet } = await api.projects.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        tetId: "TeT-service-id",
      });
    });

    it("should create a valid project with Recoco api key", async () => {
      const recocoClient = createApiClient(process.env.RECOCO_API_KEY!);

      const { data, error } = await recocoClient.projects.create({
        ...validProjet,
        externalId: "Recoco-service-id",
      });
      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProjet } = await api.projects.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        recocoId: "Recoco-service-id",
      });
    });

    it("should create a valid project when missing valid collectivites", async () => {
      const missingCodeInsee = "10110"; //Courteranges

      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projects.create({
        ...validProjet,
        collectivites: [{ code: missingCodeInsee, type: "Commune" }],
      });
      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProjet } = await api.projects.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        collectivites: [
          {
            codeInsee: missingCodeInsee,
            codeEpci: "200069250",
            type: "Commune",
            siren: "211001045",
            codeDepartements: ["10"],
            codeRegions: ["44"],
            nom: "Courteranges",
            id: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        ],
      });
    });

    it("should reject a project when collectivites are not valid", async () => {
      const missingCodeInsee = "invalidCodeInsee";

      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { error } = await mecClient.projects.create({
        ...validProjet,
        collectivites: [{ code: missingCodeInsee, type: "Commune" }],
      });
      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("Cannot find a corresponding Commune for this code invalidCodeInsee");
    });

    it("should reject when nom is empty", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        nom: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("nom should not be empty");
    });

    it("should reject when phaseStatut is provided without phase", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        phase: null,
        phaseStatut: "En cours" as PhaseStatut,
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("Cannot specify phaseStatut without a phase");
    });

    it("should automatically set phaseStatut to 'En cours' when phase is provided without phaseStatut", async () => {
      const { data, error } = await api.projects.create({
        ...validProjet,
        phase: "Idée" as ProjetPhases,
      });

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: createdProject } = await api.projects.getOne(data!.id);
      expect(createdProject).toMatchObject({
        phase: "Idée",
        phaseStatut: "En cours",
      });
    });

    it("should reject when externalId is empty", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        externalId: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("externalId should not be empty");
    });

    it("should reject when required fields are missing", async () => {
      const { error } = await api.projects.create({
        nom: "Test Projet",
      } as CreateProjetRequest);

      expect(error?.statusCode).toBe(400);
    });

    it("should reject when date is not an isoDate string", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        dateDebutPrevisionnelle: "hello",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toStrictEqual(["dateDebutPrevisionnelle must be a valid ISO 8601 date string"]);
    });

    it("should reject when project has no collectivites", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        collectivites: [],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("At least one commune insee code must be provided");
    });

    it("should reject when project a collectivite with incomplete information", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        collectivites: [{ type: "Commune", code: undefined }],
      } as unknown as CreateProjetRequest); //needed to fake invalid code

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("collectivites.0.code must be a string");
    });

    it("should reject when project has wrong competences", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        competences: ["Wrong_Competence" as Competence],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "each value in competences must be one of the following values: Autres interventions de protection civile",
      );
    });

    it("should reject when project has wrong leviers", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        leviers: ["WrongLevier" as Levier],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "each value in leviers must be one of the following values: Gestion des forêts et produits bois, Changements de pratiques de fertilisation azotée,",
      );
    });

    it("should reject when project has wrong phase", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        phase: "Wrong_Phase" as ProjetPhases,
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain("phase must be one of the following values: Idée, Etude, Opération");
    });

    it("should reject when project has wrong phaseStatut", async () => {
      const { error } = await api.projects.create({
        ...validProjet,
        phaseStatut: "Wrong_phaseStatut" as PhaseStatut,
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "phaseStatut must be one of the following values: En cours, En retard, En pause, Bloqué, Abandonné, Terminé",
      );
    });
  });

  describe("POST /projects/bulk", () => {
    const validProjets: { projects: CreateProjetRequest[] } = {
      projects: [
        mockProjetPayload({ externalId: "bulk-project-1" }),
        mockProjetPayload({ externalId: "bulk-project-2" }),
      ],
    };

    it("should reject when wrong api key", async () => {
      const wrongApiClient = createApiClient("wrong-api-key");
      const { error } = await wrongApiClient.projects.createBulk(validProjets);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should create multiple valid projects with MEC api key", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projects.createBulk(validProjets);

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
      const invalidProjets = {
        projects: [
          {
            ...mockProjetPayload(),
            nom: "", // Invalid: empty name
          },
          {
            ...mockProjetPayload(),
            nom: "",
          },
        ] as CreateProjetRequest[],
      };

      const { error } = await api.projects.createBulk(invalidProjets);

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
            nom: "Valid Projet",
            description: "Valid Description",
            budgetPrevisionnel: 100000,
            dateDebutPrevisionnelle: getFormattedDate(),
            phase: "Idée",
          },
          {
            nom: "Invalid Projet",
            description: "Invalid Description",
            budgetPrevisionnel: "hello", // Invalid budget
            dateDebutPrevisionnelle: getFormattedDate(),
            phase: "Idée",
          },
        ] as CreateProjetRequest[],
      };

      const { error } = await api.projects.createBulk(projectsWithInvalidBudget);
      expect(error?.statusCode).toBe(400);

      // Verify no projects were created
      const { data: allProjets } = await api.projects.getAll();
      const matchingProjets = allProjets?.filter((p) => p.nom === "Valid Projet" || p.nom === "Invalid Projet");
      expect(matchingProjets).toHaveLength(0);
    });
  });

  describe("PATCH /projects/:id", () => {
    let projectId: string;

    beforeEach(async () => {
      const { data } = await api.projects.create(validProjet);
      projectId = data!.id;
    });

    it("should update porteur referent email", async () => {
      const newEmail = "new.referent@email.com";
      const updateData = {
        porteur: {
          referentEmail: newEmail,
        },
        externalId: validProjet.externalId,
      };

      const { data, error } = await api.projects.update(projectId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projectId,
      });

      const { data: updatedProjet } = await api.projects.getOne(projectId);

      expect(updatedProjet).toMatchObject({
        id: projectId,
        porteur: {
          referentEmail: newEmail,
        },
      });
    });

    it("should update multiple fields at once", async () => {
      const updateData = {
        nom: "Updated Projet Name",
        description: "Updated Description",
        budgetPrevisionnel: 200000,
        porteur: {
          referentEmail: "new.referent@email.com",
        },
        externalId: validProjet.externalId,
      };

      const { data, error } = await api.projects.update(projectId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projectId,
      });

      const { data: updatedProjet } = await api.projects.getOne(projectId);

      const { externalId, ...expectedFields } = updateData;

      expect(updatedProjet).toMatchObject({
        ...expectedFields,
        id: projectId,
        mecId: validProjet.externalId,
        recocoId: null,
        tetId: null,
      });
    });

    it("should automatically set phaseStatut to 'En cours' when updating phase without phaseStatut", async () => {
      const updateData = {
        phase: "Opération" as ProjetPhases,
        externalId: validProjet.externalId,
      };

      const { data, error } = await api.projects.update(projectId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projectId,
      });

      const { data: updatedProjet } = await api.projects.getOne(projectId);

      expect(updatedProjet).toMatchObject({
        phase: "Opération",
        phaseStatut: "En cours",
      });
    });

    it("should reject update when nom is empty", async () => {
      const { error } = await api.projects.update(projectId, {
        ...validProjet,
        nom: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("nom should not be empty");
    });
  });

  describe("GET /projects/:id", () => {
    it("should return a specific project", async () => {
      const { data: createdProjet, error: _createError } = await api.projects.create(validProjet);

      const projectId = createdProjet!.id;

      const { data, error } = await api.projects.getOne(projectId);

      const { externalId, collectivites, ...expectedFields } = validProjet;

      expect(error).toBeUndefined();
      expect(data).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        ...expectedFields,
        porteur: {
          codeSiret: null,
          referentFonction: null,
          referentEmail: null,
          referentNom: null,
          referentPrenom: null,
          referentTelephone: null,
        },
        competences: ["Santé", "Culture > Arts plastiques et photographie"],
        leviers: ["Bio-carburants"],
        programme: null,
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
      await api.projects.create(validProjet);

      const { data, error } = await api.projects.getAll();

      expect(error).toBeUndefined();

      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            nom: validProjet.nom,
            collectivites: expect.arrayContaining([
              expect.objectContaining({
                codeInsee: mockedDefaultCollectivite.code,
                type: mockedDefaultCollectivite.type,
              }),
            ]),
          }),
        ]),
      );
    });
  });
});
