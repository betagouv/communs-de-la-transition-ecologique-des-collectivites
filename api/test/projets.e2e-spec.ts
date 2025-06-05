/* eslint-disable @typescript-eslint/no-unused-vars */

import { getFormattedDate } from "./helpers/get-formatted-date";
import { createApiClient } from "@test/helpers/api-client";
import { CompetenceCode, Levier } from "@/shared/types";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { collectivites, PhaseStatut, ProjetPhase } from "@database/schema";
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

  describe("POST /projets", () => {
    it("should reject when wrong api key", async () => {
      const wrongApiClient = createApiClient("wrong-api-key");
      const { error } = await wrongApiClient.projets.create(validProjet);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should create a projet with minimal fields", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);

      const minimalProjet: CreateProjetRequest = {
        nom: "minimalProjet",
        description: "minimalProjet Description",
        externalId: "minimalProjet-externalId",
        collectivites: [{ type: mockedDefaultCollectivite.type, code: mockedDefaultCollectivite.code }],
      };
      const { data, error } = await mecClient.projets.create(minimalProjet);

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");
    });

    it("should create a valid projet with MEC api key", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projets.create(validProjet);

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");
    });

    it("should create a valid projet with TeT api key", async () => {
      const tetClient = createApiClient(process.env.TET_API_KEY!);
      const { data, error } = await tetClient.projets.create({
        ...validProjet,
        phase: "Idée",
        externalId: "TeT-service-id",
      });

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProjet } = await api.projets.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        tetId: "TeT-service-id",
      });
    });

    it("should create a valid projet with Recoco api key", async () => {
      const recocoClient = createApiClient(process.env.RECOCO_API_KEY!);

      const { data, error } = await recocoClient.projets.create({
        ...validProjet,
        externalId: "Recoco-service-id",
      });
      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProjet } = await api.projets.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        competences: ["90-411", "90-311"],
        recocoId: "Recoco-service-id",
      });
    });

    it("should update competence when not provided", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);

      const { data } = await mecClient.projets.create({
        ...validProjet,
        competences: null,
        description: "rénovation des chauffage d'une ecole primaire",
        externalId: "mec-competence-not-provided",
      });

      // await 7 seconds for qualifiying competence job to finish
      await new Promise((resolve) => setTimeout(resolve, 7000));

      const { data: updatedProjet } = await api.projets.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        competences: ["90-212"],
      });
    }, 10000);

    it("should update leviers when not provided", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);

      const { data } = await mecClient.projets.create({
        ...validProjet,
        leviers: null,
        description: "Aménagement de logements sur une friche",
        externalId: "mec-leviers-not-provided",
      });

      // await 15 seconds for qualifiying levier job to finish
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const { data: updatedProjet } = await api.projets.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        leviers: ["Sobriété foncière"],
      });
    }, 20000);

    it("should create a valid projet when missing valid collectivites", async () => {
      const missingCodeInsee = "10110"; //Courteranges

      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projets.create({
        ...validProjet,
        collectivites: [{ code: missingCodeInsee, type: "Commune" }],
      });
      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: updatedProjet } = await api.projets.getOne(data!.id);

      expect(updatedProjet).toMatchObject({
        competences: ["90-411", "90-311"],
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

    it("should reject a projet when collectivites are not valid", async () => {
      const missingCodeInsee = "invalidCodeInsee";

      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { error } = await mecClient.projets.create({
        ...validProjet,
        collectivites: [{ code: missingCodeInsee, type: "Commune" }],
      });
      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("Cannot find a corresponding Commune for this code invalidCodeInsee");
    });

    it("should reject when nom is empty", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        nom: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("nom should not be empty");
    });

    it("should reject when phaseStatut is provided without phase", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        phase: null,
        phaseStatut: "En cours" as PhaseStatut,
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("Cannot specify phaseStatut without a phase");
    });

    it("should automatically set phaseStatut to 'En cours' when phase is provided without phaseStatut", async () => {
      const { data, error } = await api.projets.create({
        ...validProjet,
        phase: "Idée" as ProjetPhase,
      });

      expect(error).toBeUndefined();
      expect(data).toHaveProperty("id");

      const { data: createdProjet } = await api.projets.getOne(data!.id);
      expect(createdProjet).toMatchObject({
        phase: "Idée",
        phaseStatut: "En cours",
      });
    });

    it("should reject when externalId is empty", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        externalId: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("externalId should not be empty");
    });

    it("should reject when required fields are missing", async () => {
      const { error } = await api.projets.create({
        nom: "Test Projet",
      } as CreateProjetRequest);

      expect(error?.statusCode).toBe(400);
    });

    it("should reject when date is not an isoDate string", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        dateDebutPrevisionnelle: "hello",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toStrictEqual(["dateDebutPrevisionnelle must be a valid ISO 8601 date string"]);
    });

    it("should reject when projet has no collectivites", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        collectivites: [],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("At least one commune insee code must be provided");
    });

    it("should reject when projet a collectivite with incomplete information", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        collectivites: [{ type: "Commune", code: undefined }],
      } as unknown as CreateProjetRequest); //needed to fake invalid code

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("collectivites.0.code must be a string");
    });

    it("should reject when projet has wrong competences", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        competences: ["Wrong_Competence" as CompetenceCode],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "each value in competences must be one of the following values: 90-025, 90-11,",
      );
    });

    it("should reject when projet has wrong leviers", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        leviers: ["WrongLevier" as Levier],
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "each value in leviers must be one of the following values: Gestion des forêts et produits bois, Changements de pratiques de fertilisation azotée,",
      );
    });

    it("should reject when projet has wrong phase", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        phase: "Wrong_Phase" as ProjetPhase,
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain("phase must be one of the following values: Idée, Étude, Opération");
    });

    it("should reject when projet has wrong phaseStatut", async () => {
      const { error } = await api.projets.create({
        ...validProjet,
        phaseStatut: "Wrong_phaseStatut" as PhaseStatut,
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toContain(
        "phaseStatut must be one of the following values: En cours, En retard, En pause, Bloqué, Abandonné, Terminé",
      );
    });
  });

  describe("POST /projets/bulk", () => {
    const validProjets: { projets: CreateProjetRequest[] } = {
      projets: [mockProjetPayload({ externalId: "bulk-projet-1" }), mockProjetPayload({ externalId: "bulk-projet-2" })],
    };

    it("should reject when wrong api key", async () => {
      const wrongApiClient = createApiClient("wrong-api-key");
      const { error } = await wrongApiClient.projets.createBulk(validProjets);

      expect(error?.statusCode).toBe(401);
      expect(error?.message).toContain("Invalid API key");
    });

    it("should create multiple valid projets with MEC api key", async () => {
      const mecClient = createApiClient(process.env.MEC_API_KEY!);
      const { data, error } = await mecClient.projets.createBulk(validProjets);

      expect(error).toBeUndefined();
      expect(data?.ids).toHaveLength(2);

      // Verify each created projet
      for (const id of data!.ids) {
        const { data: projet } = await mecClient.projets.getOne(id);
        expect(projet).toBeDefined();
        expect(projet?.id).toBe(id);
      }
    });

    it("should reject when any projet in bulk request is invalid", async () => {
      const invalidProjets = {
        projets: [
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

      const { error } = await api.projets.createBulk(invalidProjets);

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toStrictEqual(["projets.0.nom should not be empty", "projets.1.nom should not be empty"]);
    });

    it("should reject when projets array is empty", async () => {
      const { error } = await api.projets.createBulk({ projets: [] });

      expect(error?.statusCode).toBe(400);
      expect(error?.message[0]).toBe("At least one projet must be provided");
    });

    it("should rollback all changes if any projet creation fails", async () => {
      const projetsWithInvalidBudget = {
        projets: [
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

      const { error } = await api.projets.createBulk(projetsWithInvalidBudget);
      expect(error?.statusCode).toBe(400);

      // Verify no projets were created
      const { data: allProjets } = await api.projets.getAll();
      const matchingProjets = allProjets?.filter((p) => p.nom === "Valid Projet" || p.nom === "Invalid Projet");
      expect(matchingProjets).toHaveLength(0);
    });
  });

  describe("PATCH /projets/:id", () => {
    let projetId: string;

    beforeEach(async () => {
      const { data } = await api.projets.create(validProjet);
      projetId = data!.id;
    });

    it("should update porteur referent email", async () => {
      const newEmail = "new.referent@email.com";
      const updateData = {
        porteur: {
          referentEmail: newEmail,
        },
        externalId: validProjet.externalId,
      };

      const { data, error } = await api.projets.update(projetId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projetId,
      });

      const { data: updatedProjet } = await api.projets.getOne(projetId);

      expect(updatedProjet).toMatchObject({
        id: projetId,
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

      const { data, error } = await api.projets.update(projetId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projetId,
      });

      const { data: updatedProjet } = await api.projets.getOne(projetId);

      const { externalId, ...expectedFields } = updateData;

      expect(updatedProjet).toMatchObject({
        ...expectedFields,
        id: projetId,
        mecId: validProjet.externalId,
        recocoId: null,
        tetId: null,
      });
    });

    it("should automatically set phaseStatut to 'En cours' when updating phase without phaseStatut", async () => {
      const updateData = {
        phase: "Opération" as ProjetPhase,
        externalId: validProjet.externalId,
      };

      const { data, error } = await api.projets.update(projetId, updateData);

      expect(error).toBeUndefined();
      expect(data).toMatchObject({
        id: projetId,
      });

      const { data: updatedProjet } = await api.projets.getOne(projetId);

      expect(updatedProjet).toMatchObject({
        phase: "Opération",
        phaseStatut: "En cours",
      });
    });

    it("should reject update when nom is empty", async () => {
      const { error } = await api.projets.update(projetId, {
        ...validProjet,
        nom: "",
      });

      expect(error?.statusCode).toBe(400);
      expect(error?.message).toContain("nom should not be empty");
    });
  });

  describe("GET /projets/:id", () => {
    it("should return a specific projet", async () => {
      const { data: createdProjet, error: _createError } = await api.projets.create(validProjet);

      const projetId = createdProjet!.id;

      const { data, error } = await api.projets.getOne(projetId);

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
        competences: ["90-411", "90-311"],
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

    it("should return 404 for non-existent projet", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const { error } = await api.projets.getOne(nonExistentId);

      expect(error?.statusCode).toBe(404);
    });
  });

  describe("GET /projets", () => {
    it("should return all projets", async () => {
      await api.projets.create(validProjet);

      const { data, error } = await api.projets.getAll();

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

  describe("GET /projets/:id/public-info", () => {
    it("should return a specific projet", async () => {
      const { data: createdProjet, error: _createError } = await api.projets.create(validProjet);

      const projetId = createdProjet!.id;

      const { data, error } = await api.projets.getPublicInfo(projetId, "communId");

      const { description, phase } = validProjet;

      expect(error).toBeUndefined();
      expect(data).toEqual({
        description,
        phase,
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

    it("should return a specific projet wit tetId", async () => {
      const tetApiClient = createApiClient(process.env.TET_API_KEY!);
      const tetProjet = mockProjetPayload({ externalId: "tet-projet-1", description: "projet tet" });
      const { error: _createError } = await tetApiClient.projets.create(tetProjet);

      const { data, error } = await tetApiClient.projets.getPublicInfo(tetProjet.externalId, "tetId");

      const { description, phase } = tetProjet;

      expect(error).toBeUndefined();
      expect(data).toEqual({
        description,
        phase,
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

    it("should return 404 for non-existent ", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const { error } = await api.projets.getOne(nonExistentId);

      expect(error?.statusCode).toBe(404);
    });
  });
});
