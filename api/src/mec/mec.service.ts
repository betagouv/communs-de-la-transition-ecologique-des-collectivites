import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DatabaseService } from "@database/database.service";
import {
  mecProjetsOperationnels,
  mecPlansTransition,
  mecProjetsToPlans,
  mecExternalIds,
  refCommunes,
  refPerimetres,
} from "@database/schema";
import { eq, and, sql } from "drizzle-orm";
import { CustomLogger } from "@logging/logger.service";
import { CreateMecProjetRequest, UpdateMecProjetRequest, MecPlanReference } from "./dto/create-mec-projet.dto";
import { createHash } from "crypto";
import { uuidv7 } from "uuidv7";
import {
  PROJECT_QUALIFICATION_QUEUE_NAME,
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
} from "@/projet-qualification/const";

@Injectable()
export class MecService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private readonly qualificationQueue: Queue,
  ) {}

  async createOrUpdate(dto: CreateMecProjetRequest, serviceType = "MEC"): Promise<{ id: string }> {
    const db = this.dbService.database;

    // 1. Resolve collectivite SIREN and territoire communes
    const { siren, territoireCommunes } = await this.resolveCollectivite(dto.collectivites[0]);

    // 2. Compute content hash
    const contentHash = this.computeContentHash(dto.nom, dto.description);

    // 3. Build fields to set
    const fieldsToSet = {
      nom: dto.nom,
      description: dto.description ?? null,
      budgetPrevisionnel: dto.budgetPrevisionnel ?? null,
      dateDebut: dto.dateDebut ?? null,
      dateFin: dto.dateFin ?? null,
      phase: dto.phase ?? null,
      phaseStatut: dto.phaseStatut ?? null,
      collectiviteResponsableSiren: siren,
      porteurOperationnelSiret: dto.porteurSiret ?? null,
      territoireCommunes: dto.territoireCommunes ?? territoireCommunes,
      competencesM57: dto.competences ?? null,
      leviersSgpe: dto.leviers ?? null,
      programmesRattachement: dto.programmes ?? null,
      classificationThematiques: dto.classificationThematiques ?? null,
      classificationSites: dto.classificationSites ?? null,
      classificationInterventions: dto.classificationInterventions ?? null,
      crteId: dto.crteId ?? null,
      crteAnneeInscription: dto.crteAnneeInscription ?? null,
      crteOrientationStrategique: dto.crteOrientationStrategique ?? null,
      sourceMec: dto.sourceMec ?? null,
      pcaetOperationInscrite: dto.pcaetOperationInscrite ?? null,
      fnvThematiques: dto.fnvThematiques ?? null,
      motsCles: dto.motsCles ?? null,
      besoins: dto.besoins ?? null,
      planRattachement: dto.planRattachement ?? null,
      contentHash,
    };

    // 4. Check if projet already exists (via external_ids)
    const [existingExternal] = await db
      .select({ objetId: mecExternalIds.objetId })
      .from(mecExternalIds)
      .where(and(eq(mecExternalIds.serviceType, serviceType), eq(mecExternalIds.externalId, dto.externalId)))
      .limit(1);

    let projetId: string;

    if (existingExternal) {
      projetId = existingExternal.objetId;

      // Check if content changed
      const [existing] = await db
        .select({ contentHash: mecProjetsOperationnels.contentHash })
        .from(mecProjetsOperationnels)
        .where(eq(mecProjetsOperationnels.id, projetId))
        .limit(1);

      await db.update(mecProjetsOperationnels).set(fieldsToSet).where(eq(mecProjetsOperationnels.id, projetId));

      // Schedule classification if content changed
      if (existing && existing.contentHash !== contentHash) {
        this.scheduleClassification(projetId);
      }
    } else {
      projetId = uuidv7();

      await db.insert(mecProjetsOperationnels).values({
        id: projetId,
        ...fieldsToSet,
      });

      await db.insert(mecExternalIds).values({
        objetId: projetId,
        serviceType,
        externalId: dto.externalId,
      });

      // Schedule classification for new records if classification is empty
      if (!dto.classificationThematiques || dto.classificationThematiques.length === 0) {
        this.scheduleClassification(projetId);
      }
    }

    // 5. Upsert plans and link them
    if (dto.plans?.length) {
      await this.upsertPlans(projetId, dto.plans, serviceType);
    }

    // 6. Auto-create CRTE plan if crteId is set
    if (dto.crteId) {
      await this.upsertCrtePlan(projetId, dto.crteId, serviceType);
    }

    return { id: projetId };
  }

  async createBulk(dtos: CreateMecProjetRequest[], serviceType = "MEC"): Promise<{ ids: string[] }> {
    const allIds: string[] = [];
    const errors: { index: number; externalId: string; error: string }[] = [];
    const chunks = this.chunkArray(dtos, 500);

    this.logger.log(`Bulk creating ${dtos.length} MEC projets in ${chunks.length} chunks of 500`);

    let globalIndex = 0;
    for (const chunk of chunks) {
      for (const dto of chunk) {
        try {
          const result = await this.createOrUpdate(dto, serviceType);
          allIds.push(result.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Bulk insert failed for projet ${dto.externalId} (index ${globalIndex}): ${message}`);
          errors.push({ index: globalIndex, externalId: dto.externalId, error: message });
        }
        globalIndex++;
      }
    }

    this.logger.log(`Bulk insert complete: ${allIds.length} succeeded, ${errors.length} failed out of ${dtos.length}`);

    if (errors.length > 0) {
      this.logger.warn(`Failed projects: ${JSON.stringify(errors.slice(0, 10))}`);
    }

    return { ids: allIds };
  }

  async findOne(id: string) {
    const db = this.dbService.database;

    const [projet] = await db.select().from(mecProjetsOperationnels).where(eq(mecProjetsOperationnels.id, id)).limit(1);

    if (!projet) {
      throw new NotFoundException(`Projet MEC with ID ${id} not found`);
    }

    // Get external IDs
    const externalIds = await db
      .select({ serviceType: mecExternalIds.serviceType, externalId: mecExternalIds.externalId })
      .from(mecExternalIds)
      .where(eq(mecExternalIds.objetId, id));

    // Get linked plans
    const planLinks = await db
      .select({
        planId: mecPlansTransition.id,
        nom: mecPlansTransition.nom,
        type: mecPlansTransition.type,
      })
      .from(mecProjetsToPlans)
      .innerJoin(mecPlansTransition, eq(mecProjetsToPlans.planTransitionId, mecPlansTransition.id))
      .where(eq(mecProjetsToPlans.projetId, id));

    return {
      ...projet,
      externalIds: externalIds.reduce(
        (acc, e) => ({ ...acc, [e.serviceType]: e.externalId }),
        {} as Record<string, string>,
      ),
      plans: planLinks,
    };
  }

  async update(id: string, dto: UpdateMecProjetRequest): Promise<{ id: string }> {
    const db = this.dbService.database;

    const [existing] = await db
      .select({ id: mecProjetsOperationnels.id })
      .from(mecProjetsOperationnels)
      .where(eq(mecProjetsOperationnels.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Projet MEC with ID ${id} not found`);
    }

    const fieldsToUpdate: Record<string, unknown> = {};

    // Resolve collectivites → SIREN + territoireCommunes (same as createOrUpdate)
    if (dto.collectivites?.length) {
      const { siren, territoireCommunes } = await this.resolveCollectivite(dto.collectivites[0]);
      fieldsToUpdate.collectiviteResponsableSiren = siren;
      if (territoireCommunes) fieldsToUpdate.territoireCommunes = territoireCommunes;
    }

    if (dto.nom !== undefined) fieldsToUpdate.nom = dto.nom;
    if (dto.description !== undefined) fieldsToUpdate.description = dto.description;
    if (dto.budgetPrevisionnel !== undefined) fieldsToUpdate.budgetPrevisionnel = dto.budgetPrevisionnel;
    if (dto.dateDebut !== undefined) fieldsToUpdate.dateDebut = dto.dateDebut;
    if (dto.dateFin !== undefined) fieldsToUpdate.dateFin = dto.dateFin;
    if (dto.phase !== undefined) fieldsToUpdate.phase = dto.phase;
    if (dto.phaseStatut !== undefined) fieldsToUpdate.phaseStatut = dto.phaseStatut;
    if (dto.porteurSiret !== undefined) fieldsToUpdate.porteurOperationnelSiret = dto.porteurSiret;
    if (dto.competences !== undefined) fieldsToUpdate.competencesM57 = dto.competences;
    if (dto.leviers !== undefined) fieldsToUpdate.leviersSgpe = dto.leviers;
    if (dto.programmes !== undefined) fieldsToUpdate.programmesRattachement = dto.programmes;
    if (dto.territoireCommunes !== undefined) fieldsToUpdate.territoireCommunes = dto.territoireCommunes;
    if (dto.classificationThematiques !== undefined)
      fieldsToUpdate.classificationThematiques = dto.classificationThematiques;
    if (dto.classificationSites !== undefined) fieldsToUpdate.classificationSites = dto.classificationSites;
    if (dto.classificationInterventions !== undefined)
      fieldsToUpdate.classificationInterventions = dto.classificationInterventions;
    if (dto.crteId !== undefined) fieldsToUpdate.crteId = dto.crteId;
    if (dto.crteAnneeInscription !== undefined) fieldsToUpdate.crteAnneeInscription = dto.crteAnneeInscription;
    if (dto.crteOrientationStrategique !== undefined)
      fieldsToUpdate.crteOrientationStrategique = dto.crteOrientationStrategique;
    if (dto.sourceMec !== undefined) fieldsToUpdate.sourceMec = dto.sourceMec;
    if (dto.pcaetOperationInscrite !== undefined) fieldsToUpdate.pcaetOperationInscrite = dto.pcaetOperationInscrite;
    if (dto.fnvThematiques !== undefined) fieldsToUpdate.fnvThematiques = dto.fnvThematiques;
    if (dto.motsCles !== undefined) fieldsToUpdate.motsCles = dto.motsCles;
    if (dto.besoins !== undefined) fieldsToUpdate.besoins = dto.besoins;
    if (dto.planRattachement !== undefined) fieldsToUpdate.planRattachement = dto.planRattachement;

    if (Object.keys(fieldsToUpdate).length > 0) {
      await db.update(mecProjetsOperationnels).set(fieldsToUpdate).where(eq(mecProjetsOperationnels.id, id));
    }

    // Auto-create CRTE plan if crteId is provided in the update
    if (dto.crteId) {
      await this.upsertCrtePlan(id, dto.crteId, "MEC");
    }

    return { id };
  }

  /**
   * Resolve collectivite to SIREN + territory communes from our referential DB.
   * Supports: Commune (code_insee → SIREN), EPCI (code = SIREN, communes from perimetres),
   * and any other groupement type (Département, Région, Syndicat — code treated as SIREN).
   */
  private async resolveCollectivite(collectivite?: {
    type: string;
    code: string;
  }): Promise<{ siren: string | null; territoireCommunes: string[] | null }> {
    if (!collectivite) return { siren: null, territoireCommunes: null };

    const db = this.dbService.database;

    if (collectivite.type === "Commune") {
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

    // EPCI or any groupement type (Département, Région, Syndicat, etc.)
    // code = SIREN of the groupement, resolve territory communes from perimetres
    const communes = await db
      .select({ codeInsee: refPerimetres.codeInseeCommune })
      .from(refPerimetres)
      .where(eq(refPerimetres.sirenGroupement, collectivite.code));

    if (communes.length === 0 && collectivite.type !== "EPCI") {
      this.logger.warn(
        `resolveCollectivite: unknown type "${collectivite.type}" for code ${collectivite.code}, no communes found`,
      );
    }

    return {
      siren: collectivite.code,
      territoireCommunes: communes.length > 0 ? communes.map((c) => c.codeInsee) : null,
    };
  }

  private async upsertPlans(projetId: string, plans: MecPlanReference[], serviceType: string): Promise<void> {
    const db = this.dbService.database;

    // Remove existing plan links for this projet
    await db.delete(mecProjetsToPlans).where(eq(mecProjetsToPlans.projetId, projetId));

    for (const plan of plans) {
      const [existingPlan] = await db
        .select({ objetId: mecExternalIds.objetId })
        .from(mecExternalIds)
        .where(and(eq(mecExternalIds.serviceType, serviceType), eq(mecExternalIds.externalId, plan.externalId)))
        .limit(1);

      let planId: string;

      if (existingPlan) {
        planId = existingPlan.objetId;
        await db
          .update(mecPlansTransition)
          .set({ nom: plan.nom ?? null, type: plan.type ?? null })
          .where(eq(mecPlansTransition.id, planId));
      } else {
        const [inserted] = await db
          .insert(mecPlansTransition)
          .values({ nom: plan.nom ?? null, type: plan.type ?? null })
          .returning();
        planId = inserted.id;

        await db.insert(mecExternalIds).values({ objetId: planId, serviceType, externalId: plan.externalId });
      }

      await db.insert(mecProjetsToPlans).values({ projetId, planTransitionId: planId }).onConflictDoNothing();
    }
  }

  /**
   * Auto-create a CRTE plan from the crteId field and link it to the project.
   * Resolves the CRTE name from snapshot_crte.contrats if available.
   */
  private async upsertCrtePlan(projetId: string, crteId: string, serviceType: string): Promise<void> {
    const db = this.dbService.database;

    // Check if plan already exists for this crteId
    const [existingPlan] = await db
      .select({ objetId: mecExternalIds.objetId })
      .from(mecExternalIds)
      .where(and(eq(mecExternalIds.serviceType, `${serviceType}_CRTE`), eq(mecExternalIds.externalId, crteId)))
      .limit(1);

    let planId: string;

    if (existingPlan) {
      planId = existingPlan.objetId;
    } else {
      // Resolve CRTE name from snapshot_crte.contrats
      const crteResult = await db.execute(
        sql`SELECT lib_crte FROM snapshot_crte.contrats WHERE id_crte = ${crteId} LIMIT 1`,
      );
      const crteName = (crteResult.rows[0] as { lib_crte?: string } | undefined)?.lib_crte ?? null;

      const [inserted] = await db.insert(mecPlansTransition).values({ nom: crteName, type: "CRTE" }).returning();
      planId = inserted.id;

      await db
        .insert(mecExternalIds)
        .values({ objetId: planId, serviceType: `${serviceType}_CRTE`, externalId: crteId });
    }

    // Link project to CRTE plan
    await db.insert(mecProjetsToPlans).values({ projetId, planTransitionId: planId }).onConflictDoNothing();
  }

  private scheduleClassification(projetId: string): void {
    this.qualificationQueue
      .add(PROJECT_QUALIFICATION_CLASSIFICATION_JOB, { projetId, schema: "data_mec" })
      .then(() => this.logger.log(`Classification scheduled for MEC projet ${projetId}`))
      .catch((err) =>
        this.logger.error(
          `Failed to schedule classification for MEC projet ${projetId}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
  }

  private computeContentHash(nom: string, description: string | null | undefined): string {
    const content = `${nom}|${description ?? ""}`;
    return createHash("sha256").update(content).digest("hex");
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
