import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import {
  tetFichesAction,
  tetPlansTransition,
  tetFichesActionToPlans,
  tetExternalIds,
  refCommunes,
  refPerimetres,
} from "@database/schema";
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

  /**
   * Build source metadata from webhook fields not in schema v0.2
   */
  buildSourceMetadata(dto: CreateFicheActionRequest): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    if (dto.budgetPrevisionnel != null) metadata.budgetPrevisionnel = dto.budgetPrevisionnel;
    if (dto.dateDebutPrevisionnelle) metadata.dateDebutPrevisionnelle = dto.dateDebutPrevisionnelle;
    if (dto.phase) metadata.phase = dto.phase;
    if (dto.phaseStatut) metadata.phaseStatut = dto.phaseStatut;
    if (dto.porteur) metadata.porteur = dto.porteur;
    return Object.keys(metadata).length > 0 ? metadata : {};
  }

  async createOrUpdate(dto: CreateFicheActionRequest, serviceType = "TeT"): Promise<{ id: string }> {
    const db = this.dbService.database;

    // 1. Resolve parent UUID from parentId (external id)
    let parentUuid: string | null = null;
    if (dto.parentExternalId) {
      const [parentExternal] = await db
        .select({ objetId: tetExternalIds.objetId })
        .from(tetExternalIds)
        .where(and(eq(tetExternalIds.serviceType, serviceType), eq(tetExternalIds.externalId, dto.parentExternalId)))
        .limit(1);
      parentUuid = parentExternal?.objetId ?? null;
    }

    // 2. Resolve collectivite SIREN and territoire communes
    const { siren, territoireCommunes } = await this.resolveCollectivite(dto.collectivites[0]);

    // 3. Build source metadata (fields not in v0.2 schema)
    const sourceMetadata = this.buildSourceMetadata(dto);

    // 4. Build fields to set
    const fieldsToSet = {
      nom: dto.nom,
      description: dto.description ?? null,
      objectifs: dto.objectifs ?? null,
      statut: dto.statut ?? dto.phaseStatut ?? null,
      competencesM57: dto.competences ?? null,
      leviersSgpe: dto.leviers ?? null,
      collectiviteResponsableSiren: siren,
      territoireCommunes,
      parentId: parentUuid,
      sourceMetadata,
    };

    // 5. Check if fiche already exists (via external_ids)
    const [existingExternal] = await db
      .select({ objetId: tetExternalIds.objetId })
      .from(tetExternalIds)
      .where(and(eq(tetExternalIds.serviceType, serviceType), eq(tetExternalIds.externalId, dto.externalId)))
      .limit(1);

    let ficheId: string;

    if (existingExternal) {
      ficheId = existingExternal.objetId;
      await db.update(tetFichesAction).set(fieldsToSet).where(eq(tetFichesAction.id, ficheId));
    } else {
      const [inserted] = await db.insert(tetFichesAction).values(fieldsToSet).returning();
      ficheId = inserted.id;

      await db.insert(tetExternalIds).values({
        objetId: ficheId,
        serviceType,
        externalId: dto.externalId,
      });
    }

    // 6. Upsert plans and link them
    if (dto.plans?.length) {
      await this.upsertPlans(ficheId, dto.plans, serviceType);
    }

    // 7. Schedule classification if not yet classified
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

  async findOne(id: string) {
    const db = this.dbService.database;

    const [fiche] = await db.select().from(tetFichesAction).where(eq(tetFichesAction.id, id)).limit(1);

    if (!fiche) {
      throw new NotFoundException(`Fiche action with ID ${id} not found`);
    }

    // Get external IDs
    const externalIds = await db
      .select({ serviceType: tetExternalIds.serviceType, externalId: tetExternalIds.externalId })
      .from(tetExternalIds)
      .where(eq(tetExternalIds.objetId, id));

    // Get linked plans
    const planLinks = await db
      .select({
        planId: tetPlansTransition.id,
        nom: tetPlansTransition.nom,
        type: tetPlansTransition.type,
      })
      .from(tetFichesActionToPlans)
      .innerJoin(tetPlansTransition, eq(tetFichesActionToPlans.planTransitionId, tetPlansTransition.id))
      .where(eq(tetFichesActionToPlans.ficheActionId, id));

    return {
      ...fiche,
      externalIds: externalIds.reduce(
        (acc, e) => ({ ...acc, [e.serviceType]: e.externalId }),
        {} as Record<string, string>,
      ),
      plans: planLinks,
    };
  }

  async update(id: string, dto: Partial<CreateFicheActionRequest>): Promise<{ id: string }> {
    const db = this.dbService.database;

    const [existing] = await db
      .select({ id: tetFichesAction.id })
      .from(tetFichesAction)
      .where(eq(tetFichesAction.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Fiche action with ID ${id} not found`);
    }

    const fieldsToUpdate: Record<string, unknown> = {};
    if (dto.nom !== undefined) fieldsToUpdate.nom = dto.nom;
    if (dto.description !== undefined) fieldsToUpdate.description = dto.description;
    if (dto.objectifs !== undefined) fieldsToUpdate.objectifs = dto.objectifs;
    if (dto.statut !== undefined) fieldsToUpdate.statut = dto.statut;
    if (dto.competences !== undefined) fieldsToUpdate.competencesM57 = dto.competences;
    if (dto.leviers !== undefined) fieldsToUpdate.leviersSgpe = dto.leviers;

    // Update source metadata if relevant fields provided
    if (
      dto.budgetPrevisionnel !== undefined ||
      dto.phase !== undefined ||
      dto.phaseStatut !== undefined ||
      dto.porteur !== undefined
    ) {
      fieldsToUpdate.sourceMetadata = this.buildSourceMetadata(dto as CreateFicheActionRequest);
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      await db.update(tetFichesAction).set(fieldsToUpdate).where(eq(tetFichesAction.id, id));
    }

    return { id };
  }

  /**
   * Resolve collectivite to SIREN + territory communes from our referential DB
   * - Commune: code_insee → SIREN via refCommunes, territoireCommunes = [code_insee]
   * - EPCI: code = SIREN, territoireCommunes from refPerimetres
   */
  private async resolveCollectivite(collectivite?: {
    type: string;
    code: string;
  }): Promise<{ siren: string | null; territoireCommunes: string[] | null }> {
    if (!collectivite) return { siren: null, territoireCommunes: null };

    const db = this.dbService.database;

    if (collectivite.type === "Commune") {
      // Resolve commune code_insee → SIREN
      const [commune] = await db
        .select({ siren: refCommunes.siren })
        .from(refCommunes)
        .where(eq(refCommunes.codeInsee, collectivite.code))
        .limit(1);

      return {
        siren: commune?.siren ?? null,
        territoireCommunes: [collectivite.code],
      };
    }

    if (collectivite.type === "EPCI") {
      // EPCI code is the SIREN, resolve territory communes
      const communes = await db
        .select({ codeInsee: refPerimetres.codeInseeCommune })
        .from(refPerimetres)
        .where(eq(refPerimetres.sirenGroupement, collectivite.code));

      return {
        siren: collectivite.code,
        territoireCommunes: communes.length > 0 ? communes.map((c) => c.codeInsee) : null,
      };
    }

    return { siren: null, territoireCommunes: null };
  }

  private async upsertPlans(ficheActionId: string, plans: PlanReference[], serviceType: string): Promise<void> {
    const db = this.dbService.database;

    await db.delete(tetFichesActionToPlans).where(eq(tetFichesActionToPlans.ficheActionId, ficheActionId));

    for (const plan of plans) {
      const [existingPlan] = await db
        .select({ objetId: tetExternalIds.objetId })
        .from(tetExternalIds)
        .where(and(eq(tetExternalIds.serviceType, serviceType), eq(tetExternalIds.externalId, plan.externalId)))
        .limit(1);

      let planId: string;

      if (existingPlan) {
        planId = existingPlan.objetId;
        await db
          .update(tetPlansTransition)
          .set({ nom: plan.nom ?? null, type: plan.type ?? null })
          .where(eq(tetPlansTransition.id, planId));
      } else {
        const [inserted] = await db
          .insert(tetPlansTransition)
          .values({ nom: plan.nom ?? null, type: plan.type ?? null })
          .returning();
        planId = inserted.id;

        await db.insert(tetExternalIds).values({ objetId: planId, serviceType, externalId: plan.externalId });
      }

      await db.insert(tetFichesActionToPlans).values({ ficheActionId, planTransitionId: planId }).onConflictDoNothing();
    }
  }

  private async scheduleClassification(ficheId: string): Promise<void> {
    this.logger.log(`Scheduling classification for fiche action ${ficheId}`);

    await this.qualificationQueue.add(
      PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
      { ficheActionId: ficheId },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  }
}
