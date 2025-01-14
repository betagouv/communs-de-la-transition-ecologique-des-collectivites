import { DatabaseService } from "@database/database.service";
import { projects } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { ProjectResponse } from "@projects/dto/project.dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CompetencesService } from "@projects/services/competences/competences.service";

@Injectable()
export class GetProjectsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly competencesService: CompetencesService,
    private readonly logger: CustomLogger,
  ) {}

  async findAll(): Promise<ProjectResponse[]> {
    this.logger.debug("Finding all projects");

    const results = await this.dbService.database.query.projects.findMany({
      with: {
        communes: {
          with: {
            commune: true,
          },
        },
      },
    });

    return results.map((result) => {
      const { competences, sousCompetences, ...rest } = result;
      const combinedCompetences = this.competencesService.combineCompetences(competences, sousCompetences);

      return {
        ...rest,
        competencesAndSousCompetences: combinedCompetences,
        communes: result.communes.map((c) => c.commune),
      };
    });
  }

  async findOne(id: string): Promise<ProjectResponse> {
    const result = await this.dbService.database.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        communes: {
          with: {
            commune: true,
          },
        },
      },
    });

    if (!result) {
      this.logger.warn("Project not found", { projectId: id });
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const { competences, sousCompetences, ...rest } = result;
    const combinedCompetences = this.competencesService.combineCompetences(competences, sousCompetences);

    return {
      ...rest,
      communes: result.communes.map((c) => c.commune),
      competencesAndSousCompetences: combinedCompetences,
    };
  }
}
