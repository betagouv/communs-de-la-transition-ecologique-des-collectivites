import { DatabaseService } from "@database/database.service";
import { projets } from "@database/schema";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { UpdateProjetRequest } from "@projets/dto/update-projet.dto";
import {
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
  PROJECT_QUALIFICATION_COMPETENCES_JOB,
  PROJECT_QUALIFICATION_LEVIERS_JOB,
  PROJECT_QUALIFICATION_QUEUE_NAME,
} from "@/projet-qualification/const";

@Injectable()
export class UpdateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private qualificationQueue: Queue,
    private logger: CustomLogger,
  ) {}

  async update(id: string, updateProjectDto: UpdateProjetRequest): Promise<{ id: string }> {
    const { collectivites, porteur, ...otherFields } = updateProjectDto;

    return this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx.select().from(projets).where(eq(projets.id, id)).limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Projet with ID ${id} not found`);
      }

      const fieldsToUpdate = removeUndefined({
        ...otherFields,
        porteurCodeSiret: porteur?.codeSiret ?? undefined,
        porteurReferentEmail: porteur?.referentEmail ?? undefined,
        porteurReferentTelephone: porteur?.referentTelephone ?? undefined,
        porteurReferentPrenom: porteur?.referentPrenom ?? undefined,
        porteurReferentNom: porteur?.referentNom ?? undefined,
        porteurReferentFonction: porteur?.referentFonction ?? undefined,
      });

      if (collectivites !== undefined && collectivites.length > 0) {
        await this.collectivitesService.createOrUpdateRelations(tx, id, collectivites);
      }

      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx.update(projets).set(fieldsToUpdate).where(eq(projets.id, id));
      }

      // Check if nom or description changed — trigger reclassification via content hash
      const newNom = otherFields.nom ?? existingProject.nom;
      const newDescription = otherFields.description ?? existingProject.description;
      const newHash = this.computeContentHash(newNom, newDescription);

      if (newHash !== existingProject.contentHash) {
        this.logger.log(
          `Content changed for projet ${id}, scheduling reclassification (hash: ${existingProject.contentHash?.slice(0, 8)} → ${newHash.slice(0, 8)})`,
        );
        await tx.update(projets).set({ contentHash: newHash }).where(eq(projets.id, id));
        await this.scheduleReclassification(id);
      }

      return { id };
    });
  }

  private computeContentHash(nom: string, description: string | null): string {
    const content = `${nom}|${description ?? ""}`;
    return createHash("sha256").update(content).digest("hex");
  }

  private async scheduleReclassification(projetId: string): Promise<void> {
    const jobs = [
      PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
      PROJECT_QUALIFICATION_COMPETENCES_JOB,
      PROJECT_QUALIFICATION_LEVIERS_JOB,
    ];

    for (const jobType of jobs) {
      await this.qualificationQueue.add(
        jobType,
        { projetId },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );
    }

    this.logger.log(`Reclassification jobs scheduled for projet ${projetId}`);
  }
}
