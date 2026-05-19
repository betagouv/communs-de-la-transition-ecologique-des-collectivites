import { DatabaseService } from "@database/database.service";
import {
  collectivites,
  mecProjetsOperationnels,
  PhaseStatut,
  projets,
  ProjetPhase,
  tetFichesAction,
} from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, inArray, InferSelectModel } from "drizzle-orm";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { CompetenceCodes, IdType, Leviers } from "@/shared/types";
import { ProjectPublicInfoResponse } from "@projets/dto/project-public-info.dto";

type Collectivite = InferSelectModel<typeof collectivites>;

type ProjetWithCollectivites = InferSelectModel<typeof projets> & {
  collectivites: { collectivite: Collectivite }[];
};

export type ProjetSource = "public" | "data_mec" | "data_tet";

export interface ProjetWithSource {
  projet: ProjetResponse;
  source: ProjetSource;
}

@Injectable()
export class GetProjetsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async findAll(): Promise<ProjetResponse[]> {
    this.logger.debug("Finding all projects");

    // Type assertion needed because Drizzle's relational query inference
    // hits TypeScript complexity limits with multi-schema setups
    const projets = (await this.dbService.database.query.projets.findMany({
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    })) as ProjetWithCollectivites[];

    return projets.map((projet) => {
      return this.mapFieldsToDTO(projet);
    });
  }

  async findOne(id: string): Promise<ProjetResponse> {
    return (await this.findOneWithSource(id)).projet;
  }

  /**
   * Comme findOne, mais retourne aussi la source réelle du projet
   * (public/data_mec/data_tet). Utile aux appelants qui doivent router le
   * traitement aval selon la table d'origine — typiquement l'enqueue de jobs
   * de classification (cf. aides.controller.ts).
   */
  async findOneWithSource(id: string): Promise<ProjetWithSource> {
    const projet = (await this.dbService.database.query.projets.findFirst({
      where: eq(projets.id, id),
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    })) as ProjetWithCollectivites | undefined;

    if (projet) {
      return { projet: this.mapFieldsToDTO(projet), source: "public" };
    }

    // Fallback : projets MEC/TeT inscrits directement dans data_mec/data_tet
    // (bypass de POST /projets côté pipeline). Aligne findOne sur getPublicInfo
    // et getServicesByProjectId qui font déjà ce fallback.
    const fallback = await this.findFallbackProjetResponse(id);
    if (fallback) return fallback;

    this.logger.warn("Projet not found", { projetId: id });
    throw new NotFoundException(`Projet with ID ${id} not found`);
  }

  async getPublicInfo(id: string, idType: IdType): Promise<ProjectPublicInfoResponse> {
    const whereCondition = eq(idType === "tetId" ? projets.tetId : projets.id, id);

    const projet = await this.dbService.database.query.projets.findFirst({
      where: whereCondition,
      columns: {
        description: true,
        phase: true,
        updatedAt: true,
      },
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    if (!projet && idType === "communId") {
      const fallback = await this.findFallbackProject(id);
      if (fallback) {
        const collectiviteList = await this.resolveCollectiviteFromSiren(fallback.siren);
        return {
          description: fallback.description,
          phase: fallback.phase as ProjectPublicInfoResponse["phase"],
          collectivites: collectiviteList,
        };
      }
    }

    if (!projet) {
      this.logger.warn(`Projet not found by ${idType}`, { [idType]: id });
      throw new NotFoundException(`Projet with ${idType} ${id} not found`);
    }

    return {
      description: projet.description,
      phase: projet.phase,
      collectivites: (projet as unknown as ProjetWithCollectivites).collectivites.map((c) => c.collectivite),
    };
  }

  private mapFieldsToDTO(projet: ProjetWithCollectivites): ProjetResponse {
    const {
      porteurReferentEmail,
      porteurCodeSiret,
      porteurReferentTelephone,
      porteurReferentNom,
      porteurReferentPrenom,
      porteurReferentFonction,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      contentHash: _contentHash,
      ...rest
    } = projet;

    return {
      ...rest,
      porteur: {
        codeSiret: porteurCodeSiret,
        referentEmail: porteurReferentEmail,
        referentTelephone: porteurReferentTelephone,
        referentNom: porteurReferentNom,
        referentPrenom: porteurReferentPrenom,
        referentFonction: porteurReferentFonction,
      },
      competences: projet.competences ? (projet.competences as CompetenceCodes) : null,
      leviers: projet.leviers ? (projet.leviers as Leviers) : null,
      collectivites: projet.collectivites.map((c) => c.collectivite),
    };
  }

  /**
   * Search data_mec then data_tet for a project not found in public.projets.
   */
  private async findFallbackProject(
    id: string,
  ): Promise<{ description: string | null; phase: string | null; siren: string | null } | null> {
    this.logger.warn("Falling back to data_mec for project lookup", { id });
    const [mecProjet] = await this.dbService.database
      .select({
        description: mecProjetsOperationnels.description,
        phase: mecProjetsOperationnels.phase,
        siren: mecProjetsOperationnels.collectiviteResponsableSiren,
      })
      .from(mecProjetsOperationnels)
      .where(eq(mecProjetsOperationnels.id, id));

    if (mecProjet) return mecProjet;

    this.logger.warn("Falling back to data_tet for project lookup", { id });
    const [tetFiche] = await this.dbService.database
      .select({
        description: tetFichesAction.description,
        siren: tetFichesAction.collectiviteResponsableSiren,
      })
      .from(tetFichesAction)
      .where(eq(tetFichesAction.id, id));

    if (tetFiche) return { ...tetFiche, phase: null };

    return null;
  }

  /**
   * Full-DTO fallback for findOne. Used when projet absent de public.projets
   * mais présent dans data_mec.projets_operationnels ou data_tet.fiches_action.
   */
  private async findFallbackProjetResponse(id: string): Promise<ProjetWithSource | null> {
    this.logger.warn("Falling back to data_mec for findOne", { projetId: id });
    const [mec] = await this.dbService.database
      .select()
      .from(mecProjetsOperationnels)
      .where(eq(mecProjetsOperationnels.id, id));

    if (mec) {
      const collectivitesList = await this.resolveCollectivitesFromTerritoire(
        mec.territoireCommunes,
        mec.collectiviteResponsableSiren,
      );
      return { projet: this.mapMecToProjetResponse(mec, collectivitesList), source: "data_mec" };
    }

    this.logger.warn("Falling back to data_tet for findOne", { projetId: id });
    const [tet] = await this.dbService.database.select().from(tetFichesAction).where(eq(tetFichesAction.id, id));

    if (tet) {
      const collectivitesList = await this.resolveCollectivitesFromTerritoire(
        tet.territoireCommunes,
        tet.collectiviteResponsableSiren,
      );
      return { projet: this.mapTetToProjetResponse(tet, collectivitesList), source: "data_tet" };
    }

    return null;
  }

  private mapMecToProjetResponse(
    mec: InferSelectModel<typeof mecProjetsOperationnels>,
    collectivitesList: Collectivite[],
  ): ProjetResponse {
    return {
      id: mec.id,
      createdAt: mec.createdAt,
      updatedAt: mec.updatedAt,
      nom: mec.nom,
      description: mec.description,
      porteur: null,
      collectivites: collectivitesList,
      budgetPrevisionnel: mec.budgetPrevisionnel,
      dateDebutPrevisionnelle: mec.dateDebut,
      phaseStatut: (mec.phaseStatut as PhaseStatut | null) ?? null,
      phase: (mec.phase as ProjetPhase | null) ?? null,
      programme: null,
      competences: (mec.competencesM57 as CompetenceCodes | null) ?? null,
      leviers: (mec.leviersSgpe as Leviers | null) ?? null,
      classificationThematiques: mec.classificationThematiques ?? null,
      classificationSites: mec.classificationSites ?? null,
      classificationInterventions: mec.classificationInterventions ?? null,
      probabiliteTE: mec.probabiliteTe !== null && mec.probabiliteTe !== undefined ? String(mec.probabiliteTe) : null,
      classificationScores: mec.classificationScores ?? null,
      mecId: null,
      tetId: null,
      recocoId: null,
    };
  }

  private mapTetToProjetResponse(
    tet: InferSelectModel<typeof tetFichesAction>,
    collectivitesList: Collectivite[],
  ): ProjetResponse {
    return {
      id: tet.id,
      createdAt: tet.createdAt,
      updatedAt: tet.updatedAt,
      nom: tet.nom,
      description: tet.description,
      porteur: null,
      collectivites: collectivitesList,
      budgetPrevisionnel: null,
      dateDebutPrevisionnelle: null,
      phaseStatut: null,
      phase: null,
      programme: null,
      competences: (tet.competencesM57 as CompetenceCodes | null) ?? null,
      leviers: (tet.leviersSgpe as Leviers | null) ?? null,
      classificationThematiques: tet.classificationThematiques ?? null,
      classificationSites: tet.classificationSites ?? null,
      classificationInterventions: tet.classificationInterventions ?? null,
      probabiliteTE: tet.probabiliteTE ?? null,
      classificationScores: tet.classificationScores ?? null,
      mecId: null,
      tetId: null,
      recocoId: null,
    };
  }

  /**
   * Résout les collectivités d'un projet MEC/TeT.
   * 1) territoire_communes (codes INSEE) → query batch sur public.collectivites
   * 2) Fallback sur collectivite_responsable_siren si territoire vide
   */
  private async resolveCollectivitesFromTerritoire(
    codesInsee: string[] | null,
    siren: string | null,
  ): Promise<Collectivite[]> {
    if (codesInsee && codesInsee.length > 0) {
      const rows = await this.dbService.database
        .select()
        .from(collectivites)
        .where(inArray(collectivites.codeInsee, codesInsee));
      if (rows.length > 0) return rows;
    }
    return this.resolveCollectiviteFromSiren(siren);
  }

  /**
   * Resolve a SIREN to a collectivite object. Checks public.collectivites first,
   * returns a minimal stub if not found.
   */
  private async resolveCollectiviteFromSiren(siren: string | null): Promise<Collectivite[]> {
    if (!siren) return [];

    const [existing] = await this.dbService.database.select().from(collectivites).where(eq(collectivites.siren, siren));

    if (existing) return [existing];

    // Minimal stub — SIREN exists but not in our collectivites table
    return [
      {
        id: siren,
        nom: "",
        type: "Commune",
        codeInsee: null,
        codeEpci: null,
        codeDepartements: null,
        codeRegions: null,
        siren,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Collectivite,
    ];
  }
}
