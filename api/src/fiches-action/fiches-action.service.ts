import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { tetFichesAction, tetPlansTransition, tetFichesActionToPlans, tetExternalIds } from "@database/schema";
import { eq, and } from "drizzle-orm";
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

  async createOrUpdate(dto: CreateFicheActionRequest, serviceType = "TeT"): Promise<{ id: string }> {
    const db = this.dbService.database;

    // 1. Resolve parent UUID from parentId (external id)
    let parentUuid: string | null = null;
    if (dto.parentId) {
      const [parentExternal] = await db
        .select({ objetId: tetExternalIds.objetId })
        .from(tetExternalIds)
        .where(and(eq(tetExternalIds.serviceType, serviceType), eq(tetExternalIds.externalId, dto.parentId)))
        .limit(1);
      parentUuid = parentExternal?.objetId ?? null;
    }

    // 2. Resolve collectivite SIREN
    const collectivite = dto.collectivites[0];
    const siren = collectivite?.type === "EPCI" ? collectivite.code : collectivite?.type === "Commune" ? null : null;

    // 3. Check if fiche already exists (via external_ids)
    const [existingExternal] = await db
      .select({ objetId: tetExternalIds.objetId })
      .from(tetExternalIds)
      .where(and(eq(tetExternalIds.serviceType, serviceType), eq(tetExternalIds.externalId, dto.externalId)))
      .limit(1);

    let ficheId: string;

    if (existingExternal) {
      // Update existing fiche
      ficheId = existingExternal.objetId;
      await db
        .update(tetFichesAction)
        .set({
          nom: dto.nom,
          description: dto.description ?? null,
          objectifs: dto.objectifs ?? null,
          statut: dto.statut ?? dto.phaseStatut ?? null,
          competencesM57: dto.competences ?? null,
          leviersSgpe: dto.leviers ?? null,
          collectiviteResponsableSiren: siren,
          parentId: parentUuid,
        })
        .where(eq(tetFichesAction.id, ficheId));
    } else {
      // Insert new fiche
      const [inserted] = await db
        .insert(tetFichesAction)
        .values({
          nom: dto.nom,
          description: dto.description ?? null,
          objectifs: dto.objectifs ?? null,
          statut: dto.statut ?? dto.phaseStatut ?? null,
          competencesM57: dto.competences ?? null,
          leviersSgpe: dto.leviers ?? null,
          collectiviteResponsableSiren: siren,
          parentId: parentUuid,
        })
        .returning();
      ficheId = inserted.id;

      // Register external ID
      await db.insert(tetExternalIds).values({
        objetId: ficheId,
        serviceType,
        externalId: dto.externalId,
      });
    }

    // 4. Upsert plans and link them
    if (dto.plans?.length) {
      await this.upsertPlans(ficheId, dto.plans, serviceType);
    }

    // 5. Schedule classification if not yet classified
    const [fiche] = await db
      .select({ classificationThematiques: tetFichesAction.classificationThematiques })
      .from(tetFichesAction)
      .where(eq(tetFichesAction.id, ficheId))
      .limit(1);

    if (!fiche?.classificationThematiques || fiche.classificationThematiques.length === 0) {
      await this.scheduleClassification(ficheId);
    }

    return { id: ficheId };
  }

  private async upsertPlans(ficheActionId: string, plans: PlanReference[], serviceType: string): Promise<void> {
    const db = this.dbService.database;

    // Delete existing plan links for this fiche
    await db.delete(tetFichesActionToPlans).where(eq(tetFichesActionToPlans.ficheActionId, ficheActionId));

    for (const plan of plans) {
      // Check if plan already exists via external_ids
      const [existingPlan] = await db
        .select({ objetId: tetExternalIds.objetId })
        .from(tetExternalIds)
        .where(and(eq(tetExternalIds.serviceType, serviceType), eq(tetExternalIds.externalId, plan.id)))
        .limit(1);

      let planId: string;

      if (existingPlan) {
        planId = existingPlan.objetId;
        // Update plan metadata
        await db
          .update(tetPlansTransition)
          .set({ nom: plan.nom ?? null, type: plan.type ?? null })
          .where(eq(tetPlansTransition.id, planId));
      } else {
        // Insert new plan
        const [inserted] = await db
          .insert(tetPlansTransition)
          .values({ nom: plan.nom ?? null, type: plan.type ?? null })
          .returning();
        planId = inserted.id;

        // Register external ID
        await db.insert(tetExternalIds).values({
          objetId: planId,
          serviceType,
          externalId: plan.id,
        });
      }

      // Link fiche → plan
      await db.insert(tetFichesActionToPlans).values({ ficheActionId, planTransitionId: planId }).onConflictDoNothing();
    }
  }

  private async scheduleClassification(ficheId: string): Promise<void> {
    this.logger.log(`Scheduling classification for fiche action ${ficheId}`);

    await this.qualificationQueue.add(
      PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
      { ficheActionId: ficheId },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );
  }
}
