import { DatabaseService } from "@database/database.service";
import { ConflictException, Injectable } from "@nestjs/common";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { projets } from "@database/schema";
import { eq } from "drizzle-orm";
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

  async create(createProjectDto: CreateProjetRequest, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { externalId, porteur, ...otherFields } = createProjectDto;

    return this.dbService.database.transaction(async (tx) => {
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

      await this.collectivitesService.createOrUpdateRelations(tx, upsertedProject.id, createProjectDto.collectivites);

      if (!createProjectDto.competences || createProjectDto.competences.length === 0) {
        await this.scheduleProjectQualification(upsertedProject.id);
      }

      return { id: upsertedProject.id };
    });
  }

  async createBulk(bulkCreateProjectsRequest: BulkCreateProjetsRequest, apiKey: string): Promise<{ ids: string[] }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    return this.dbService.database.transaction(async (tx) => {
      const createdProjects = [];

      for (const projectDto of bulkCreateProjectsRequest.projects) {
        const { collectivites, externalId, porteur, ...projectFields } = projectDto;

        const existingProject = await this.dbService.database
          .select()
          .from(projets)
          .where(eq(projets[serviceIdField], externalId))
          .limit(1);

        if (existingProject.length > 0) {
          throw new ConflictException(`Projet with ${serviceIdField} ${externalId} already exists`);
        }

        const [newProject] = await tx
          .insert(projets)
          .values({
            ...projectFields,
            [serviceIdField]: externalId,
            ...this.mapPorteurToDatabase(porteur),
          })
          .returning({ id: projets.id });

        await this.collectivitesService.createOrUpdateRelations(tx, newProject.id, collectivites);

        createdProjects.push(newProject);
      }

      return { ids: createdProjects.map((p) => p.id) };
    });
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
