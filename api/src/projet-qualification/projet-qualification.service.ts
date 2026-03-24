import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import { InternalServerErrorException } from "@nestjs/common";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import {
  COMPETENCE_SCORE_TRESHOLD,
  LEVIER_SCORE_TRESHOLD,
  PROJECT_QUALIFICATION_COMPETENCES_JOB,
  PROJECT_QUALIFICATION_LEVIERS_JOB,
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
} from "@/projet-qualification/const";
import { ClassificationService } from "@/projet-qualification/classification/classification.service";
import { DatabaseService } from "@database/database.service";
import { tetFichesAction } from "@database/schema";
import { eq } from "drizzle-orm";
import { UpdateProjetsService } from "@projets/services/update-projets/update-projets.service";
import { ServiceType } from "@/shared/types";
import {
  ProjetLeviersResponse,
  ProjetQualificationResponse,
} from "@/projet-qualification/dto/projet-qualification.dto";
import * as Sentry from "@sentry/node";
import { AnthropicService } from "@/projet-qualification/llm/anthropic.service";
import { LeviersValidationService } from "@/projet-qualification/llm/validation/leviers-validation.service";
import { CompetencesValidationService } from "@/projet-qualification/llm/validation/competences-validation.service";

@Processor("project-qualification")
export class ProjetQualificationService extends WorkerHost {
  constructor(
    private readonly projetUpdateService: UpdateProjetsService,
    private readonly projetGetService: GetProjetsService,
    private readonly anthropicService: AnthropicService,
    private readonly leviersValidationService: LeviersValidationService,
    private readonly competencesValidationService: CompetencesValidationService,
    private readonly classificationService: ClassificationService,
    private readonly dbService: DatabaseService,
    private logger: CustomLogger,
  ) {
    super();
  }

  async process(job: Job<{ projetId?: string; ficheActionId?: string }>) {
    const { projetId, ficheActionId } = job.data;
    const entityId = projetId ?? ficheActionId;
    this.logger.log(
      `Processing qualification job for ${projetId ? "project" : "fiche"} ${entityId} for job ${job.name}`,
    );
    try {
      // Handle fiche action classification (from data_tet)
      if (ficheActionId && job.name === PROJECT_QUALIFICATION_CLASSIFICATION_JOB) {
        await this.classifyFicheAction(ficheActionId);
        return;
      }

      if (!projetId) {
        throw new Error("projetId is required for non-fiche jobs");
      }

      const projet = await this.projetGetService.findOne(projetId);

      // we only trigger the job from the create service when there is a description or a name
      // but since it's async, and the descritption might have been removed at the time the job is processed we recheck in this logic too
      if (projet.description || projet.nom) {
        const context = `${projet.nom}\n${projet.description}`;

        switch (job.name) {
          case PROJECT_QUALIFICATION_COMPETENCES_JOB:
            await this.analyzeAndUpdateCompetences(context, projet.id);
            break;
          case PROJECT_QUALIFICATION_LEVIERS_JOB:
            await this.analyzeAndUpdateLeviers(context, projet.id);
            break;
          case PROJECT_QUALIFICATION_CLASSIFICATION_JOB:
            await this.analyzeAndUpdateClassification(context, projet.id);
            break;
          default:
            throw new Error(`${job.name} is not covered yet`);
        }
      }
    } catch (error) {
      this.logger.error(`Error qualifying and updating project ${projetId} for job ${job.name}`, {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      Sentry.captureException(error);

      throw new InternalServerErrorException(`Error qualifying project ${projetId} for job ${job.name}`);
    }
  }

  private async analyzeAndUpdateLeviers(context: string, projetId: string): Promise<void> {
    this.logger.log(`Starting leviers analysis for project ${projetId}`);

    // Call Anthropic service to analyze leviers
    const analysisResult = await this.anthropicService.analyzeLeviers(context);

    if (analysisResult.errorMessage) {
      throw new Error(`Error while qualifying leviers for ${projetId} - error : ${analysisResult.errorMessage}`);
    }

    // Validate and correct leviers using validation service
    const validatedLeviers = this.leviersValidationService.validateAndCorrect(
      analysisResult.json,
      LEVIER_SCORE_TRESHOLD,
    );

    if (validatedLeviers.length === 0) {
      this.logger.log(`No levier found for project ${projetId} with context ${context}`);
      return;
    }

    // Update project with validated leviers
    const levierNames = validatedLeviers.map((levier) => levier.nom);
    await this.projetUpdateService.update(projetId, { leviers: levierNames });

    this.logger.log(
      `Successfully qualified project ${projetId} with leviers ${validatedLeviers.map((l) => l.nom).join()}`,
    );
  }

  private async analyzeAndUpdateCompetences(context: string, projetId: string): Promise<void> {
    this.logger.log(`Starting competences analysis for project ${projetId}`);

    // Call Anthropic service to analyze competences
    const analysisResult = await this.anthropicService.analyzeCompetences(context);

    if (analysisResult.errorMessage) {
      throw new Error(`Error while qualifying competences for ${projetId} - error : ${analysisResult.errorMessage}`);
    }

    // Validate and correct competences using validation service
    const validatedCompetences = this.competencesValidationService.validateAndCorrect(analysisResult.json);

    if (validatedCompetences.length === 0) {
      this.logger.log(`No competences found for project ${projetId} with context ${context}`);
      return;
    }

    // Filter competences by score threshold (matching Python implementation on STAGING)
    const competencesCodes = validatedCompetences.filter((c) => c.score > COMPETENCE_SCORE_TRESHOLD).map((c) => c.code);

    // Update project with validated competences
    await this.projetUpdateService.update(projetId, { competences: competencesCodes });

    this.logger.log(`Successfully qualified project ${projetId} with competences code ${competencesCodes.join()}`);
  }

  private async analyzeAndUpdateClassification(context: string, projetId: string): Promise<void> {
    this.logger.log(`Starting classification analysis for project ${projetId}`);

    // Get all scores (threshold 0) for jsonb storage and matching
    const allScores = await this.classificationService.classify(context, "projet", 0);

    // Store full scores for matching
    const classificationScores = {
      thematiques: allScores.thematiques,
      sites: allScores.sites,
      interventions: allScores.interventions,
    };

    // Filter for text[] columns (default threshold 0.8)
    const classificationThematiques = allScores.thematiques.filter((t) => t.score >= 0.8).map((t) => t.label);
    const classificationSites = allScores.sites.filter((s) => s.score >= 0.8).map((s) => s.label);
    const classificationInterventions = allScores.interventions.filter((i) => i.score >= 0.8).map((i) => i.label);
    const probabiliteTE = allScores.probabiliteTE !== null ? String(allScores.probabiliteTE) : null;

    await this.projetUpdateService.update(projetId, {
      classificationThematiques,
      classificationSites,
      classificationInterventions,
      probabiliteTE,
      classificationScores,
    });

    this.logger.log(
      `Successfully classified project ${projetId} with ${classificationThematiques.length} thématiques, ${classificationSites.length} sites, ${classificationInterventions.length} interventions (TE: ${probabiliteTE})`,
    );
  }

  private async classifyFicheAction(ficheActionId: string): Promise<void> {
    const [fiche] = await this.dbService.database
      .select()
      .from(tetFichesAction)
      .where(eq(tetFichesAction.id, ficheActionId))
      .limit(1);

    if (!fiche || (!fiche.nom && !fiche.description)) {
      this.logger.log(`Fiche action ${ficheActionId} not found or empty, skipping classification`);
      return;
    }

    const context = `${fiche.nom}\n${fiche.description ?? ""}`;
    this.logger.log(`Classifying fiche action ${ficheActionId}: ${fiche.nom.slice(0, 60)}`);

    const allScores = await this.classificationService.classify(context, "projet", 0);

    const classificationScores = {
      thematiques: allScores.thematiques,
      sites: allScores.sites,
      interventions: allScores.interventions,
    };

    await this.dbService.database
      .update(tetFichesAction)
      .set({
        classificationThematiques: allScores.thematiques.filter((t) => t.score >= 0.8).map((t) => t.label),
        classificationSites: allScores.sites.filter((s) => s.score >= 0.8).map((s) => s.label),
        classificationInterventions: allScores.interventions.filter((i) => i.score >= 0.8).map((i) => i.label),
        probabiliteTE: allScores.probabiliteTE !== null ? String(allScores.probabiliteTE) : null,
        classificationScores,
      })
      .where(eq(tetFichesAction.id, ficheActionId));

    this.logger.log(`Successfully classified fiche action ${ficheActionId}`);
  }

  async analyzeCompetences(context: string, serviceType: ServiceType): Promise<ProjetQualificationResponse> {
    this.logger.log(`Analyzing competences for ${serviceType} context`);

    // Call Anthropic service to analyze competences
    const analysisResult = await this.anthropicService.analyzeCompetences(context);

    if (analysisResult.errorMessage) {
      throw new InternalServerErrorException(
        `Error while qualifying competences - error : ${analysisResult.errorMessage}`,
      );
    }

    // Validate and correct competences using validation service
    const validatedCompetences = this.competencesValidationService.validateAndCorrect(analysisResult.json);

    if (validatedCompetences.length === 0) {
      this.logger.log(`No competences found for project with context ${context} for ${serviceType}`);
    }

    // Filter competences by score threshold (matching Python implementation on STAGING)
    const competences = validatedCompetences.filter((c) => c.score > COMPETENCE_SCORE_TRESHOLD);

    return {
      projet: context,
      competences,
    };
  }

  async analyzeLeviers(context: string): Promise<ProjetLeviersResponse> {
    // Use Anthropic service to analyze leviers
    const analysisResult = await this.anthropicService.analyzeLeviers(context);

    // If there's an error message, throw it
    if (analysisResult.errorMessage) {
      throw new InternalServerErrorException(`Error while qualifying leviers - error: ${analysisResult.errorMessage}`);
    }

    // Validate and correct leviers using validation service
    const validatedLeviers = this.leviersValidationService.validateAndCorrect(
      analysisResult.json,
      LEVIER_SCORE_TRESHOLD,
    );

    // If no leviers found, log it
    if (validatedLeviers.length === 0) {
      this.logger.log(`No leviers found for project with context ${context}`);
    }

    // Return the response
    return {
      projet: context,
      classification: analysisResult.json.classification,
      leviers: validatedLeviers,
    };
  }
}
