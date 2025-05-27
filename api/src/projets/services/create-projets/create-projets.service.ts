import { DatabaseService, Tx } from "@database/database.service";
import { Injectable } from "@nestjs/common";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { projets } from "@database/schema";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { ServiceIdentifierService } from "@projets/services/service-identifier/service-identifier.service";
import { BulkCreateProjetsRequest } from "@projets/dto/bulk-create-projets.dto";
import { PorteurDto } from "@projets/dto/porteur.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import { PROJECT_QUALIFICATION_COMPETENCES_JOB, PROJECT_QUALIFICATION_QUEUE_NAME } from "@/projet-qualification/const";

@Injectable()
export class CreateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private qualificationQueue: Queue,
    private logger: CustomLogger,
  ) {}

  async create(createProjetDto: CreateProjetRequest, apiKey: string): Promise<{ id: string }> {
    return this.dbService.database.transaction(async (tx) => {
      const projectId = await this.createOrUpdateProjet(tx, createProjetDto, apiKey);

      return { id: projectId };
    });
  }

  async createBulk(bulkCreateProjectsRequest: BulkCreateProjetsRequest, apiKey: string): Promise<{ ids: string[] }> {
    return this.dbService.database.transaction(async (tx) => {
      const createdProjets: string[] = [];

      for (const projetDto of bulkCreateProjectsRequest.projets) {
        const result = await this.createOrUpdateProjet(tx, projetDto, apiKey);
        createdProjets.push(result);
      }

      return { ids: createdProjets };
    });
  }

  private async createOrUpdateProjet(tx: Tx, projectDto: CreateProjetRequest, apiKey: string): Promise<string> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { externalId, porteur, collectivites, ...otherFields } = projectDto;

    const [upsertedProject] = await tx
      .insert(projets)
      .values({
        ...otherFields,
        [serviceIdField]: externalId,
        ...this.mapPorteurToDatabase(porteur),
      })
      .onConflictDoUpdate({
        target: projets[serviceIdField],
        set: {
          ...otherFields,
          ...this.mapPorteurToDatabase(porteur),
          updatedAt: new Date(),
        },
      })
      .returning();

    await this.collectivitesService.createOrUpdateRelations(tx, upsertedProject.id, collectivites);

    const hasProjetNoCompetences = !upsertedProject.competences || upsertedProject.competences.length === 0;

    if (hasProjetNoCompetences) {
      this.logger.log(
        `Triggering qualification for upsertedProject ${upsertedProject.id} with description ${upsertedProject.description}`,
        { competences: upsertedProject.competences },
      );
      await this.scheduleProjectQualification(upsertedProject.id);
    }

    return upsertedProject.id;
  }

  private async scheduleProjectQualification(projetId: string): Promise<void> {
    this.logger.log(`Scheduling qualification for projet ${projetId}`);

    await this.qualificationQueue.add(
      PROJECT_QUALIFICATION_COMPETENCES_JOB,
      { projetId },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    this.logger.log(`Qualification job scheduled for project ${projetId}`);
  }

  private mapPorteurToDatabase(porteur: PorteurDto | null | undefined) {
    return {
      porteurCodeSiret: porteur?.codeSiret ?? null,
      porteurReferentEmail: porteur?.referentEmail ?? null,
      porteurReferentTelephone: porteur?.referentTelephone ?? null,
      porteurReferentNom: porteur?.referentNom ?? null,
      porteurReferentPrenom: porteur?.referentPrenom ?? null,
      porteurReferentFonction: porteur?.referentFonction ?? null,
    };
  }
}
