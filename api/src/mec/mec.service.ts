import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import {
  mecProjetsOperationnels,
  mecPlansTransition,
  mecProjetsToPlans,
  mecExternalIds,
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
import { CreateMecProjetRequest, MecPlanReference } from "./dto/create-mec-projet.dto";
import { createHash } from "crypto";
import { uuidv7 } from "uuidv7";

@Injectable()
export class MecService {
  constructor(
    private readonly dbService: DatabaseService,
    @InjectQueue(PROJECT_QUALIFICATION_QUEUE_NAME) private qualificationQueue: Queue,
    private readonly logger: CustomLogger,
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
        await this.scheduleClassification(projetId);
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
        await this.scheduleClassification(projetId);
      }
    }

    // 5. Upsert plans and link them
    if (dto.plans?.length) {
      await this.upsertPlans(projetId, dto.plans, serviceType);
    }

    return { id: projetId };
  }

  async createBulk(dtos: CreateMecProjetRequest[], serviceType = "MEC"): Promise<{ ids: string[] }> {
    const allIds: string[] = [];
    const chunks = this.chunkArray(dtos, 500);

    this.logger.log(`Bulk creating ${dtos.length} MEC projets in ${chunks.length} chunks of 500`);

    for (const chunk of chunks) {
      for (const dto of chunk) {
        const result = await this.createOrUpdate(dto, serviceType);
        allIds.push(result.id);
      }
    }

    this.logger.log(`Bulk insert complete: ${allIds.length} MEC projets`);

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

  async update(id: string, dto: Partial<CreateMecProjetRequest>): Promise<{ id: string }> {
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

  private async scheduleClassification(projetId: string): Promise<void> {
    // TODO: The qualification worker currently reads/writes from public.projets directly.
    // For now, schedule the classification job the same way — adjust the worker later to support data_mec.
    this.logger.log(`Scheduling classification for MEC projet ${projetId}`);

    await this.qualificationQueue.add(
      PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
      { projetId, schema: "data_mec" },
      { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
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
