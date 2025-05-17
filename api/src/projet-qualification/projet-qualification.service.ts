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
  PROJECT_QUALIFICATION_COMPETENCES_JOB,
  PROJECT_QUALIFICATION_LEVIERS_JOB,
} from "@/projet-qualification/const";
import { UpdateProjetsService } from "@projets/services/update-projets/update-projets.service";
import { existsSync } from "fs";

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
      // we only trigger the job from the create service when there is a description
      // but since it's async, and the descritption might have been removed at the time the job is processed we recheck in this logic too
      if (projet.description) {
        switch (job.name) {
          case PROJECT_QUALIFICATION_COMPETENCES_JOB:
            await this.analyzeAndUpdateCompetences(projet.description, projet.id);
            break;
          case PROJECT_QUALIFICATION_LEVIERS_JOB:
            throw new Error("need to implement it ");
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

      throw new InternalServerErrorException(`Error qualifying project ${projetId} for job ${job.name}`);
    }
  }
  private async analyzeAndUpdateCompetences(description: string, projetId: string): Promise<void> {
    const result = await this.analyzeProjet<CompetencesResult>(description, "competences");

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

  private async analyzeProjet<T>(description: string, type: "TE" | "competences"): Promise<T> {
    return new Promise((resolve, reject) => {
      const escapedDescription = description.replace(/'/g, "'\\''");

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
          /* if (type === "TE") {
            const classificationResult = JSON.parse(outputs[0]);
            console.log("Classification Result:", classificationResult);
            jsonResult = classificationResult;
            console.log("Final Result:", jsonResult);
          } else {*/
          resolve(jsonResult);
        } catch (e) {
          reject(new Error(`Failed to parse JSON output: ${e instanceof Error ? e.message : String(e)}`));
        }
      });
    });
  }
}
