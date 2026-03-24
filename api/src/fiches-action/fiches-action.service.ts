import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { tetFichesAction, tetPlansTransition, tetFichesActionToPlans } from "@database/schema";
import { eq } from "drizzle-orm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CustomLogger } from "@logging/logger.service";
import {
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
  PROJECT_QUALIFICATION_QUEUE_NAME,
} from "@/projet-qualification/const";
import { CreateFicheActionRequest, PlanReference } from "./dto/create-fiche-action.dto";

@Injectable()
export class FichesActionService {
  constructor(
    private readonly dbService: DatabaseService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private qualificationQueue: Queue,
    private readonly logger: CustomLogger,
  ) {}

  async createOrUpdate(dto: CreateFicheActionRequest): Promise<{ id: string }> {
    const db = this.dbService.database;

    // 1. Upsert fiche action
    const [upserted] = await db
      .insert(tetFichesAction)
      .values({
        tetId: dto.externalId,
        nom: dto.nom,
        description: dto.description ?? null,
        statut: dto.statut ?? dto.phaseStatut ?? null,
        budgetPrevisionnel: dto.budgetPrevisionnel ?? null,
        dateDebutPrevisionnelle: dto.dateDebutPrevisionnelle ?? null,
        parentTetId: dto.parentId ?? null,
        porteurReferentNom: dto.porteur?.referentNom ?? null,
        porteurReferentEmail: dto.porteur?.referentEmail ?? null,
        porteurReferentTelephone: dto.porteur?.referentTelephone ?? null,
        collectiviteType: dto.collectivites[0]?.type ?? null,
        collectiviteCode: dto.collectivites[0]?.code ?? null,
      })
      .onConflictDoUpdate({
        target: tetFichesAction.tetId,
        set: {
          nom: dto.nom,
          description: dto.description ?? null,
          statut: dto.statut ?? dto.phaseStatut ?? null,
          budgetPrevisionnel: dto.budgetPrevisionnel ?? null,
          dateDebutPrevisionnelle: dto.dateDebutPrevisionnelle ?? null,
          parentTetId: dto.parentId ?? null,
          porteurReferentNom: dto.porteur?.referentNom ?? null,
          porteurReferentEmail: dto.porteur?.referentEmail ?? null,
          porteurReferentTelephone: dto.porteur?.referentTelephone ?? null,
          collectiviteType: dto.collectivites[0]?.type ?? null,
          collectiviteCode: dto.collectivites[0]?.code ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // 2. Upsert plans and link them
    if (dto.plans?.length) {
      await this.upsertPlans(upserted.id, dto.plans);
    }

    // 3. Schedule classification if not yet classified
    if (!upserted.classificationThematiques || upserted.classificationThematiques.length === 0) {
      await this.scheduleClassification(upserted.id, upserted.tetId);
    }

    return { id: upserted.id };
  }

  private async upsertPlans(ficheActionId: string, plans: PlanReference[]): Promise<void> {
    const db = this.dbService.database;

    // Delete existing plan links for this fiche
    await db.delete(tetFichesActionToPlans).where(eq(tetFichesActionToPlans.ficheActionId, ficheActionId));

    for (const plan of plans) {
      // Upsert plan
      const [upsertedPlan] = await db
        .insert(tetPlansTransition)
        .values({
          tetId: plan.id,
          nom: plan.nom ?? null,
          type: plan.type ?? null,
        })
        .onConflictDoUpdate({
          target: tetPlansTransition.tetId,
          set: {
            nom: plan.nom ?? null,
            type: plan.type ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Link fiche → plan
      await db
        .insert(tetFichesActionToPlans)
        .values({
          ficheActionId,
          planTransitionId: upsertedPlan.id,
        })
        .onConflictDoNothing();
    }
  }

  private async scheduleClassification(ficheId: string, tetId: string): Promise<void> {
    this.logger.log(`Scheduling classification for fiche action ${tetId}`);

    await this.qualificationQueue.add(
      PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
      { ficheActionId: ficheId },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );
  }
}
