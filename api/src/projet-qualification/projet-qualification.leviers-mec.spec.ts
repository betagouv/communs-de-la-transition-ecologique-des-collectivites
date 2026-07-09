import { InternalServerErrorException } from "@nestjs/common";
import { Job } from "bullmq";
import { ProjetQualificationService } from "./projet-qualification.service";
import { PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB } from "./const";
import { LEVIERS_PREDICTION_VERSION } from "@/shared/const/leviers";
import { AnthropicService } from "@/projet-qualification/llm/anthropic.service";
import { LeviersValidationService } from "@/projet-qualification/llm/validation/leviers-validation.service";
import { DatabaseService } from "@database/database.service";
import { LeviersAnalysisResult } from "@/projet-qualification/llm/prompts/types";
import { LevierDto } from "@/projet-qualification/dto/projet-qualification.dto";

// Test unitaire pur (DB mockée) du chemin leviers → data_mec du worker de qualification.
// Ne dépend d'aucun testcontainer : constructible sans Nest DI (WorkerHost n'a pas de constructeur).
describe("ProjetQualificationService — prédiction leviers data_mec", () => {
  let service: ProjetQualificationService;
  let analyzeLeviers: jest.Mock;
  let validateAndCorrect: jest.Mock;
  let limit: jest.Mock;
  let setMock: jest.Mock;
  let updateWhere: jest.Mock;
  let database: DatabaseService["database"];

  const makeJob = (projetId: string): Job<{ projetId: string; schema: string }> =>
    ({ name: PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB, data: { projetId, schema: "data_mec" } }) as Job<{
      projetId: string;
      schema: string;
    }>;

  beforeEach(() => {
    limit = jest.fn();
    updateWhere = jest.fn().mockResolvedValue(undefined);
    setMock = jest.fn().mockReturnValue({ where: updateWhere });

    database = {
      select: jest.fn().mockReturnValue({ from: () => ({ where: () => ({ limit }) }) }),
      update: jest.fn().mockReturnValue({ set: setMock }),
    } as unknown as DatabaseService["database"];

    analyzeLeviers = jest.fn();
    validateAndCorrect = jest.fn();

    const anthropicService = { analyzeLeviers } as unknown as AnthropicService;
    const leviersValidationService = { validateAndCorrect } as unknown as LeviersValidationService;
    const dbService = { database } as unknown as DatabaseService;
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    service = new ProjetQualificationService(
      {} as never,
      {} as never,
      anthropicService,
      leviersValidationService,
      {} as never,
      {} as never,
      dbService,
      logger as never,
    );
  });

  const analysis = (): LeviersAnalysisResult => ({
    json: {
      projet: "Rénovation école",
      classification: "Le projet a un lien avec la transition écologique",
      leviers: { "Rénovation (hors changement chaudières)": 0.9 },
    },
    raisonnement: "interne",
    errorMessage: "",
  });

  it("écrit data_mec.llm_leviers ([{label, score}]) + version, pas leviers_sgpe", async () => {
    limit.mockResolvedValueOnce([{ id: "p1", nom: "Rénovation école", description: "isolation" }]);
    analyzeLeviers.mockResolvedValueOnce(analysis());
    const validated: LevierDto[] = [
      { nom: "Rénovation (hors changement chaudières)", score: 0.9 },
      { nom: "Sobriété des bâtiments (tertiaire)", score: 0.3 },
    ];
    validateAndCorrect.mockReturnValueOnce(validated);

    await service.process(makeJob("p1"));

    // Threshold 0 : toute la distribution validée est passée (le consommateur filtre).
    expect(validateAndCorrect).toHaveBeenCalledWith(expect.anything(), 0);
    expect(setMock).toHaveBeenCalledWith({
      llmLeviers: [
        { label: "Rénovation (hors changement chaudières)", score: 0.9 },
        { label: "Sobriété des bâtiments (tertiaire)", score: 0.3 },
      ],
      llmLeviersVersion: LEVIERS_PREDICTION_VERSION,
    });
  });

  it("écrit un tableau vide + version quand aucun levier n'est prédit (distinct de NULL)", async () => {
    limit.mockResolvedValueOnce([{ id: "p1", nom: "Projet neutre", description: "" }]);
    analyzeLeviers.mockResolvedValueOnce(analysis());
    validateAndCorrect.mockReturnValueOnce([]);

    await service.process(makeJob("p1"));

    expect(setMock).toHaveBeenCalledWith({ llmLeviers: [], llmLeviersVersion: LEVIERS_PREDICTION_VERSION });
  });

  it("ne fait rien quand le projet est introuvable", async () => {
    limit.mockResolvedValueOnce([]);

    await service.process(makeJob("absent"));

    expect(analyzeLeviers).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("remonte une erreur (InternalServerError) quand l'analyse LLM échoue", async () => {
    limit.mockResolvedValueOnce([{ id: "p1", nom: "Rénovation école", description: "isolation" }]);
    analyzeLeviers.mockResolvedValueOnce({ ...analysis(), errorMessage: "timeout LLM" });

    await expect(service.process(makeJob("p1"))).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(setMock).not.toHaveBeenCalled();
  });
});
