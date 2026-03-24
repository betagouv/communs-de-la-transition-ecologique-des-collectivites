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

    const needsCompetences = !upsertedProject.competences || upsertedProject.competences.length === 0 || contentChanged;
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
