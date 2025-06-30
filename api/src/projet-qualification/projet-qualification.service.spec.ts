import { TestingModule } from "@nestjs/testing";
import { ProjetQualificationService } from "./projet-qualification.service";
import { Job } from "bullmq";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { collectivites } from "@database/schema";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import {
  CompetencesResult,
  LeviersResult,
  PROJECT_QUALIFICATION_COMPETENCES_JOB,
  PROJECT_QUALIFICATION_LEVIERS_JOB,
} from "./const";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { CompetenceCode } from "@/shared/types";
import { ProjetQualificationResponse } from "@/projet-qualification/dto/projet-qualification.dto";

describe("ProjetQualificationService", () => {
  let createService: CreateProjetsService;
  let findService: GetProjetsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let qualificationService: ProjetQualificationService;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    createService = module.get<CreateProjetsService>(CreateProjetsService);
    findService = module.get<GetProjetsService>(GetProjetsService);
    qualificationService = module.get<ProjetQualificationService>(ProjetQualificationService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();
    await testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune 1",
    });
  });

  describe("process", () => {
    it("should process a qualifying competences job successfully", async () => {
      const createDto = mockProjetPayload({
        description: "rénovation du chauffage d'une école primaire",
        competences: null,
      });
      const createdProjet = await createService.create(createDto, "MEC_test_api_key");

      const mockCompetencesResult: CompetencesResult = {
        projet: "Test projet",
        competences: [
          {
            code: "90-75" as CompetenceCode,
            score: 0.9,
            competence: "Politique de l'énergie",
            sous_competence: "Test",
          },
        ],
        errorMessage: "",
      };

      jest.spyOn<any, any>(qualificationService, "analyzeProjet").mockResolvedValueOnce(mockCompetencesResult);

      const mockJob = {
        name: PROJECT_QUALIFICATION_COMPETENCES_JOB,
        data: { projetId: createdProjet.id },
      } as Job<{ projetId: string }>;

      // Process job
      await qualificationService.process(mockJob);

      const updatedProjet = await findService.findOne(createdProjet.id);
      expect(updatedProjet.competences).toEqual(["90-75"]);
    });

    it("should process a qualifying leviers job successfully", async () => {
      const createDto = mockProjetPayload({
        description: "rénovation du chauffage d'une école primaire",
        leviers: null,
      });
      const createdProjet = await createService.create(createDto, "MEC_test_api_key");

      const mockCompetencesResult: LeviersResult = {
        projet: "Test projet",
        classification: null,
        raisonnement: null,
        leviers: {
          "Elevage durable": 0.6,
          "Sobriété foncière": 0.9,
        },
        errorMessage: "",
      };

      jest.spyOn<any, any>(qualificationService, "analyzeProjet").mockResolvedValueOnce(mockCompetencesResult);

      const mockJob = {
        name: PROJECT_QUALIFICATION_LEVIERS_JOB,
        data: { projetId: createdProjet.id },
      } as Job<{ projetId: string }>;

      // Process job
      await qualificationService.process(mockJob);

      const updatedProjet = await findService.findOne(createdProjet.id);
      expect(updatedProjet.leviers).toEqual(["Sobriété foncière"]);
    });

    it("should handle errors in analyzeProjet", async () => {
      const createDto = mockProjetPayload({
        description: "rénovation du chauffage d'une école primaire",
      });
      const createdProjet = await createService.create(createDto, "MEC_test_api_key");

      jest.spyOn<any, any>(qualificationService, "analyzeProjet").mockRejectedValueOnce(new Error("Test error"));

      const mockJob = {
        name: PROJECT_QUALIFICATION_COMPETENCES_JOB,
        data: { projetId: createdProjet.id },
      } as Job<{ projetId: string }>;

      await expect(qualificationService.process(mockJob)).rejects.toThrow();
    });
  });

  describe("qualify competences", () => {
    it("should qualify competences successfully", async () => {
      const mockCompetencesResult: CompetencesResult = {
        projet: "Test projet",
        competences: [
          {
            code: "90-75",
            score: 0.9,
            competence: "Politique de l'énergie",
            sous_competence: "Test",
          },
          {
            code: "90-314",
            score: 0.4,
            competence: "Culture > Musées",
            sous_competence: "Test",
          },
          {
            code: "90-41",
            score: 0.8,
            competence: "Santé",
            sous_competence: "Test",
          },
        ],
        errorMessage: "",
      };
      const context = "Nom et description du projet";

      jest.spyOn<any, any>(qualificationService, "analyzeProjet").mockResolvedValueOnce(mockCompetencesResult);

      const result = await qualificationService.analyzeCompetences(context, "MEC");

      const firstMatch = mockCompetencesResult.competences[0];
      const secondMatch = mockCompetencesResult.competences[2];

      const expectedResult: ProjetQualificationResponse = {
        projet: context,
        competences: [
          { code: firstMatch.code, nom: firstMatch.competence, score: firstMatch.score },
          { code: secondMatch.code, nom: secondMatch.competence, score: secondMatch.score },
        ],
      };

      expect(result).toEqual(expectedResult);
    });
  });
});
