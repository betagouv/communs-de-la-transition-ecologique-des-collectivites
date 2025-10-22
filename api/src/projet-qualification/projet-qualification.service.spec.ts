import { TestingModule } from "@nestjs/testing";
import { ProjetQualificationService } from "./projet-qualification.service";
import { Job } from "bullmq";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { collectivites } from "@database/schema";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { PROJECT_QUALIFICATION_COMPETENCES_JOB, PROJECT_QUALIFICATION_LEVIERS_JOB } from "./const";
import { CreateProjetsService } from "@projets/services/create-projets/create-projets.service";
import { CompetenceCode } from "@/shared/types";
import { AnthropicService } from "@/projet-qualification/llm/anthropic.service";
import { CompetencesValidationService } from "@/projet-qualification/llm/validation/competences-validation.service";
import { LeviersValidationService } from "@/projet-qualification/llm/validation/leviers-validation.service";
import { CompetenceDto, LevierDto } from "@/projet-qualification/dto/projet-qualification.dto";
import {
  CompetenceLLMItem,
  CompetencesAnalysisResult,
  LeviersAnalysisResult,
} from "@/projet-qualification/llm/prompts/types";

describe("ProjetQualificationService", () => {
  let createService: CreateProjetsService;
  let findService: GetProjetsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let qualificationService: ProjetQualificationService;
  let anthropicService: AnthropicService;
  let competencesValidationService: CompetencesValidationService;
  let leviersValidationService: LeviersValidationService;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    createService = module.get<CreateProjetsService>(CreateProjetsService);
    findService = module.get<GetProjetsService>(GetProjetsService);
    qualificationService = module.get<ProjetQualificationService>(ProjetQualificationService);
    anthropicService = module.get<AnthropicService>(AnthropicService);
    competencesValidationService = module.get<CompetencesValidationService>(CompetencesValidationService);
    leviersValidationService = module.get<LeviersValidationService>(LeviersValidationService);
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

    // Reset all mocks before each test
    jest.restoreAllMocks();
  });

  describe("process", () => {
    it("should process a qualifying competences job successfully", async () => {
      const createDto = mockProjetPayload({
        description: "rénovation du chauffage d'une école primaire",
        competences: null,
      });
      const createdProjet = await createService.create(createDto, process.env.MEC_API_KEY!);

      // Mock Anthropic service to return analysis result
      const mockAnthropicResult: CompetencesAnalysisResult = {
        json: {
          projet: "Test projet",
          competences: [
            {
              code: "90-75" as CompetenceCode,
              score: 0.9,
              competence: "Politique de l'énergie",
            } as CompetenceLLMItem,
          ],
        },
        errorMessage: "",
      };
      jest.spyOn(anthropicService, "analyzeCompetences").mockResolvedValueOnce(mockAnthropicResult);

      // Mock validation service to return validated competences
      const mockValidatedCompetences: CompetenceDto[] = [
        {
          code: "90-75",
          score: 0.9,
          nom: "Politique de l'énergie",
        },
      ];
      jest.spyOn(competencesValidationService, "validateAndCorrect").mockReturnValueOnce(mockValidatedCompetences);

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
      const createdProjet = await createService.create(createDto, process.env.MEC_API_KEY!);

      // Mock Anthropic service to return analysis result
      const mockAnthropicResult: LeviersAnalysisResult = {
        json: {
          projet: "Test projet",
          leviers: {
            "Elevage durable": 0.6,
            "Sobriété foncière": 0.9,
          },
          classification: "Le projet a un lien avec la transition écologique",
        },
        errorMessage: "",
        raisonnement: "Explication du lien avec la transition écologique",
      };
      jest.spyOn(anthropicService, "analyzeLeviers").mockResolvedValueOnce(mockAnthropicResult);

      // Mock validation service to return validated leviers
      const mockValidatedLeviers: LevierDto[] = [
        {
          nom: "Sobriété foncière",
          score: 0.9,
        },
      ];
      jest.spyOn(leviersValidationService, "validateAndCorrect").mockReturnValueOnce(mockValidatedLeviers);

      const mockJob = {
        name: PROJECT_QUALIFICATION_LEVIERS_JOB,
        data: { projetId: createdProjet.id },
      } as Job<{ projetId: string }>;

      // Process job
      await qualificationService.process(mockJob);

      const updatedProjet = await findService.findOne(createdProjet.id);
      expect(updatedProjet.leviers).toEqual(["Sobriété foncière"]);
    });

    it("should handle errors in job processing", async () => {
      const createDto = mockProjetPayload({
        description: "rénovation du chauffage d'une école primaire",
      });
      const createdProjet = await createService.create(createDto, process.env.MEC_API_KEY!);

      // Mock Anthropic service to throw an error
      jest.spyOn(anthropicService, "analyzeCompetences").mockRejectedValueOnce(new Error("Test error"));

      const mockJob = {
        name: PROJECT_QUALIFICATION_COMPETENCES_JOB,
        data: { projetId: createdProjet.id },
      } as Job<{ projetId: string }>;

      await expect(qualificationService.process(mockJob)).rejects.toThrow();
    });
  });

  describe("analyze competences", () => {
    it("should qualify competences successfully", async () => {
      const mockAnthropicResult: CompetencesAnalysisResult = {
        json: {
          projet: "Test projet",
          competences: [
            {
              code: "90-75" as CompetenceCode,
              score: 0.9,
              competence: "Politique de l'énergie",
            } as CompetenceLLMItem,
            {
              code: "90-314" as CompetenceCode,
              score: 0.4,
              competence: "Culture > Musées",
            } as CompetenceLLMItem,
            {
              code: "90-41" as CompetenceCode,
              score: 0.8,
              competence: "Santé",
            } as CompetenceLLMItem,
          ],
        },
        errorMessage: "",
      };
      const context = "Nom et description du projet";

      // Mock Anthropic service to return analysis result
      jest.spyOn(anthropicService, "analyzeCompetences").mockResolvedValueOnce(mockAnthropicResult);

      // Mock validation service to return validated competences
      const mockCompetences: CompetenceDto[] = mockAnthropicResult.json.competences
        .filter((c: CompetenceLLMItem) => c.score > 0.7)
        .map((c: CompetenceLLMItem) => ({
          code: c.code as CompetenceCode,
          nom: c.competence,
          score: c.score,
        }));

      jest.spyOn(competencesValidationService, "validateAndCorrect").mockReturnValueOnce(mockCompetences);

      const result = await qualificationService.analyzeCompetences(context, "MEC");

      expect(result).toEqual({
        projet: context,
        competences: [
          { code: "90-75", nom: "Politique de l'énergie", score: 0.9 },
          { code: "90-41", nom: "Santé", score: 0.8 },
        ],
      });
    });
  });
});
