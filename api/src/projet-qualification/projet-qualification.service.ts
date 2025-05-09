import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import { UpdateProjetsService } from "@projets/services/update-projets/update-projets.service";
import { CompetenceCodes } from "@/shared/types";
import { InternalServerErrorException } from "@nestjs/common";

@Processor("project-qualification")
export class ProjetQualificationService extends WorkerHost {
  constructor(
    private readonly projetUpdateService: UpdateProjetsService,
    private logger: CustomLogger,
  ) {
    super();
  }

  async process(job: Job<{ projetId: string }>) {
    const { projetId } = job.data;

    this.logger.log(`Processing qualification job for project ${projetId}`);

    try {
      const competencesCodes = await this.analyzeProjectSkills("test");

      // this will throw if projet is not found
      await this.projetUpdateService.update(projetId, { competences: competencesCodes });

      this.logger.log(
        `Successfully qualified project ${projetId} with competences code: ${competencesCodes.join(", ")}`,
      );

      //todo do I really need to catch those error with my globale exception handler ?
    } catch (error) {
      this.logger.error(`Error qualifying project ${projetId}`, { error });
      throw new InternalServerErrorException(`Error qualifying project ${projetId}`);
    }
  }

  private async analyzeProjectSkills(description: string): Promise<CompetenceCodes> {
    try {
      // Pour le test, on renvoie des valeurs hardcodées
      // Plus tard, ce sera remplacé par un appel à un script Python ou un LLM

      // Simuler un appel à un script Python (à des fins de démonstration)
      // const { stdout } = await execPromise('python3 ./scripts/analyze_skills.py "' + description.replace(/"/g, '\\"') + '"');
      // return JSON.parse(stdout);

      // Pour l'instant, on retourne des compétences hardcodées
      const mockSkills: CompetenceCodes = ["90-18"];

      // Simulation d'un traitement qui prend du temps
      await new Promise((resolve) => setTimeout(resolve, 5000));

      return mockSkills;
    } catch (error) {
      this.logger.error(`Error analyzing projet description to get competence for description ${description}`, {
        error,
      });
      // En cas d'erreur, retourner au moins quelques skills génériques
      throw new InternalServerErrorException(`Error analyzing projet description to get competence`);
    }
  }
}
