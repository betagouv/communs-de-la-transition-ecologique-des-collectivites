import { DatabaseService, Tx } from "@database/database.service";
import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
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
import {
  PROJECT_QUALIFICATION_COMPETENCES_JOB,
  PROJECT_QUALIFICATION_LEVIERS_JOB,
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
  PROJECT_QUALIFICATION_QUEUE_NAME,
  QualificationJobType,
} from "@/projet-qualification/const";
import { BATCH_CLASSIFICATION_QUEUE_NAME } from "@/batch-classification/batch-classification.const";

@Injectable()
export class CreateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private qualificationQueue: Queue,
    @InjectQueue(BATCH_CLASSIFICATION_QUEUE_NAME) private batchClassificationQueue: Queue,
    private logger: CustomLogger,
  ) {}

  async create(createProjetDto: CreateProjetRequest, apiKey: string): Promise<{ id: string }> {
    return this.dbService.database.transaction(async (tx) => {
      const projectId = await this.createOrUpdateProjet(tx, createProjetDto, apiKey);

      return { id: projectId };
    });
  }

  async createBulk(bulkCreateProjectsRequest: BulkCreateProjetsRequest, apiKey: string): Promise<{ ids: string[] }> {
    const allIds: string[] = [];
    const chunks = this.chunkArray(bulkCreateProjectsRequest.projets, 500);

    this.logger.log(
      `Bulk creating ${bulkCreateProjectsRequest.projets.length} projects in ${chunks.length} chunks of 500`,
    );

    for (const chunk of chunks) {
      const ids = await this.dbService.database.transaction(async (tx) => {
        const chunkIds: string[] = [];
        for (const projetDto of chunk) {
          const id = await this.createOrUpdateProjet(tx, projetDto, apiKey, { skipQualificationJobs: true });
          chunkIds.push(id);
        }
        return chunkIds;
      });
      allIds.push(...ids);
    }

    // Trigger batch classification for newly inserted projects
    await this.batchClassificationQueue.add("submit", {
      triggeredBy: "bulk",
      projectCount: allIds.length,
    });

    this.logger.log(`Bulk insert complete: ${allIds.length} projects, batch classification scheduled`);

    return { ids: allIds };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async createOrUpdateProjet(
    tx: Tx,
    projectDto: CreateProjetRequest,
    apiKey: string,
    options?: { skipQualificationJobs?: boolean },
  ): Promise<string> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { externalId, porteur, collectivites, ...otherFields } = projectDto;

    const contentHash = this.computeContentHash(otherFields.nom, otherFields.description);

    // Read existing project to compare content hash (for upsert case)
    const [existingProject] = await tx
      .select({ contentHash: projets.contentHash })
      .from(projets)
      .where(eq(projets[serviceIdField], externalId))
      .limit(1);

    const [upsertedProject] = await tx
      .insert(projets)
      .values({
        ...otherFields,
        contentHash,
        [serviceIdField]: externalId,
        ...this.mapPorteurToDatabase(porteur),
      })
      .onConflictDoUpdate({
        target: projets[serviceIdField],
        set: {
          ...otherFields,
          contentHash,
          ...this.mapPorteurToDatabase(porteur),
          updatedAt: new Date(),
        },
      })
      .returning();

    await this.collectivitesService.createOrUpdateRelations(tx, upsertedProject.id, collectivites);

    // Content changed if existing project had a different hash (upsert case)
    const contentChanged = existingProject !== undefined && existingProject.contentHash !== contentHash;

    if (!options?.skipQualificationJobs) {
      const needsCompetences =
        !upsertedProject.competences || upsertedProject.competences.length === 0 || contentChanged;
      const needsLeviers = !upsertedProject.leviers || upsertedProject.leviers.length === 0 || contentChanged;
      const needsClassification =
        !upsertedProject.classificationThematiques ||
        upsertedProject.classificationThematiques.length === 0 ||
        contentChanged;

      if (needsCompetences) {
        this.logger.log(
          `Triggering competence qualification for projet ${upsertedProject.id}${contentChanged ? " (content changed)" : ""}`,
        );
        await this.scheduleProjectQualification(upsertedProject.id, PROJECT_QUALIFICATION_COMPETENCES_JOB);
      }

      if (needsLeviers) {
        this.logger.log(
          `Triggering leviers qualification for projet ${upsertedProject.id}${contentChanged ? " (content changed)" : ""}`,
        );
        await this.scheduleProjectQualification(upsertedProject.id, PROJECT_QUALIFICATION_LEVIERS_JOB);
      }

      if (needsClassification) {
        this.logger.log(
          `Triggering classification for projet ${upsertedProject.id}${contentChanged ? " (content changed)" : ""}`,
        );
        await this.scheduleProjectQualification(upsertedProject.id, PROJECT_QUALIFICATION_CLASSIFICATION_JOB);
      }
    }

    return upsertedProject.id;
  }

  private async scheduleProjectQualification(projetId: string, jobType: QualificationJobType): Promise<void> {
    this.logger.log(`Scheduling ${jobType} qualification for projet ${projetId}`);

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

    this.logger.log(`Qualification job scheduled for project ${projetId}`);
  }

  private computeContentHash(nom: string, description: string | null | undefined): string {
    const content = `${nom}|${description ?? ""}`;
    return createHash("sha256").update(content).digest("hex");
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
