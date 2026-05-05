import { DatabaseService } from "@database/database.service";
import { collectivites, mecProjetsOperationnels, projets, tetFichesAction } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, InferSelectModel } from "drizzle-orm";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { CompetenceCodes, IdType, Leviers } from "@/shared/types";
import { ProjectPublicInfoResponse } from "@projets/dto/project-public-info.dto";

type Collectivite = InferSelectModel<typeof collectivites>;

type ProjetWithCollectivites = InferSelectModel<typeof projets> & {
  collectivites: { collectivite: Collectivite }[];
};

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

    if (!projet) {
      this.logger.warn("Projet not found", { projetId: id });
      throw new NotFoundException(`Projet with ID ${id} not found`);
    }

    return this.mapFieldsToDTO(projet);
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
