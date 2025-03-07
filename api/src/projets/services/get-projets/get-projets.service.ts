import { DatabaseService } from "@database/database.service";
import { projets } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Competences, Leviers } from "@/shared/types";
import { ProjetResponse } from "@projets/dto/projet.dto";

@Injectable()
export class GetProjetsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async findAll(): Promise<ProjetResponse[]> {
    this.logger.debug("Finding all projects");

    const results = await this.dbService.database.query.projets.findMany({
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    return results.map((result) => {
      return {
        ...result,
        competences: result.competences ? (result.competences as Competences) : null,
        leviers: result.leviers ? (result.leviers as Leviers) : null,
        collectivites: result.collectivites.map((c) => c.collectivite),
      };
    });
  }

  async findOne(id: string): Promise<ProjetResponse> {
    const result = await this.dbService.database.query.projets.findFirst({
      where: eq(projets.id, id),
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    if (!result) {
      this.logger.warn("Project not found", { projectId: id });
      throw new NotFoundException(`Projet with ID ${id} not found`);
    }

    return {
      ...result,
      competences: result.competences ? (result.competences as Competences) : null,
      leviers: result.leviers ? (result.leviers as Leviers) : null,
      collectivites: result.collectivites.map((c) => c.collectivite),
    };
  }
}
