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
} from "@/projet-qualification/const";
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
    private logger: CustomLogger,
  ) {
    super();
  }

  async process(job: Job<{ projetId: string }>) {
    const { projetId } = job.data;
    this.logger.log(`Processing qualification job for project ${projetId} for job ${job.name}`);
    try {
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
      raisonnement: analysisResult.raisonnement,
    };
  }
}
