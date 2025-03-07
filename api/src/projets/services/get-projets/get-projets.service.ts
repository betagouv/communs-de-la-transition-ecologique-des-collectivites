import { DatabaseService } from "@database/database.service";
import { collectivites, projets } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, InferSelectModel } from "drizzle-orm";
import { ProjetResponse } from "@projets/dto/projet.dto";
import { Competences, Leviers } from "@/shared/types";

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

    const projets = await this.dbService.database.query.projets.findMany({
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    return projets.map((projet) => {
      return this.mapFieldsToDTO(projet);
    });
  }

  async findOne(id: string): Promise<ProjetResponse> {
    const projet = await this.dbService.database.query.projets.findFirst({
      where: eq(projets.id, id),
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    if (!projet) {
      this.logger.warn("Projet not found", { projetId: id });
      throw new NotFoundException(`Projet with ID ${id} not found`);
    }

    return this.mapFieldsToDTO(projet);
  }

  private mapFieldsToDTO(projet: ProjetWithCollectivites): ProjetResponse {
    const {
      porteurReferentEmail,
      porteurCodeSiret,
      porteurReferentTelephone,
      porteurReferentNom,
      porteurReferentPrenom,
      porteurReferentFonction,
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
      competences: projet.competences ? (projet.competences as Competences) : null,
      leviers: projet.leviers ? (projet.leviers as Leviers) : null,
      collectivites: projet.collectivites.map((c) => c.collectivite),
    };
  }
}
