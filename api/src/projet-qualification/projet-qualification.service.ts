import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import { InternalServerErrorException } from "@nestjs/common";
import path from "path";
import { spawn } from "child_process";
import { GetProjetsService } from "@projets/services/get-projets/get-projets.service";
import {
  COMPETENCE_SCORE_TRESHOLD,
  CompetencesResult,
  LEVIER_SCORE_TRESHOLD,
  LeviersResult,
  PROJECT_QUALIFICATION_COMPETENCES_JOB,
  PROJECT_QUALIFICATION_LEVIERS_JOB,
} from "@/projet-qualification/const";
import { UpdateProjetsService } from "@projets/services/update-projets/update-projets.service";
import { existsSync } from "fs";
import { Levier, ServiceType } from "@/shared/types";
import { ProjetQualificationResponse } from "@/projet-qualification/dto/projet-qualification.dto";
import * as Sentry from "@sentry/node";

@Processor("project-qualification")
export class ProjetQualificationService extends WorkerHost {
  constructor(
    private readonly projetUpdateService: UpdateProjetsService,
    private readonly projetGetService: GetProjetsService,
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
    const result = await this.analyzeProjet<LeviersResult>(context, "TE");

    if (Object.keys(result.leviers).length === 0) {
      this.logger.log(`No levier found for project ${projetId} with context ${context}`);
      return;
    }

    if (result.errorMessage) {
      throw new Error(`Error while qualifying leviers for ${projetId} - error : ${result.errorMessage}`);
    }

    const keptLeviers = Object.entries(result.leviers)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, score]) => score > LEVIER_SCORE_TRESHOLD)
      .map(([name]) => name as Levier);

    await this.projetUpdateService.update(projetId, { leviers: keptLeviers });

    this.logger.log(`Successfully qualified project ${projetId} with leviers ${keptLeviers.join()}`);
  }

  private async analyzeAndUpdateCompetences(context: string, projetId: string): Promise<void> {
    const result = await this.analyzeProjet<CompetencesResult>(context, "competences");
    if (result.competences.length === 0) {
      this.logger.log(`No competences found for project ${projetId} with context ${context}`);
      return;
    }

    if (result.errorMessage) {
      throw new Error(`Error while qualifying competences for ${projetId} - error : ${result.errorMessage}`);
    }

    const competencesCodes = result.competences
      .filter((competence) => competence.score > COMPETENCE_SCORE_TRESHOLD)
      .map((competence) => competence.code);

    // this will throw if projet is not found
    await this.projetUpdateService.update(projetId, { competences: competencesCodes });

    this.logger.log(`Successfully qualified project ${projetId} with competences code ${competencesCodes.join()}`);
  }

  async analyzeCompetences(context: string, serviceType: ServiceType): Promise<ProjetQualificationResponse> {
    const result = await this.analyzeProjet<CompetencesResult>(context, "competences");

    if (result.competences.length === 0) {
      this.logger.log(`No competences found for project with context ${context} for ${serviceType}`);
    }

    if (result.errorMessage) {
      throw new InternalServerErrorException(`Error while qualifying competences - error : ${result.errorMessage}`);
    }

    const competences = result.competences
      .filter((competence) => competence.score > COMPETENCE_SCORE_TRESHOLD)
      .map((competence) => ({ code: competence.code, score: competence.score, nom: competence.competence }));

    return {
      projet: context,
      competences,
    };
  }

  async analyzeProjet<T>(context: string, type: "TE" | "competences"): Promise<T> {
    return new Promise((resolve, reject) => {
      const escapedDescription = context.replace(/'/g, "'\\''");
      const pythonScript = path.join(__dirname, "llm-scripts", "competences-and-leviers-qualification.py");

      if (!existsSync(pythonScript)) {
        throw new Error(`Le script Python n'existe pas : ${pythonScript}`);
      }

      const pythonProcess = spawn("python3", [pythonScript, `'${escapedDescription}'`, "--type", type]);

      let outputString = "";
      let errorString = "";

      pythonProcess.stdout.on("data", (data: Buffer) => {
        outputString += data.toString();
      });

      pythonProcess.stderr.on("data", (data: Buffer) => {
        errorString += data.toString();
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}. Error: ${errorString}`));
          return;
        }
        try {
          const jsonResult = JSON.parse(outputString) as T;
          resolve(jsonResult);
        } catch (e) {
          reject(new Error(`Failed to parse JSON output: ${e instanceof Error ? e.message : String(e)}`));
        }
      });
    });
  }
}
