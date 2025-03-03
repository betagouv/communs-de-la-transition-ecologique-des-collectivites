import { DatabaseService } from "@database/database.service";
import { projects } from "@database/schema";
import { CustomLogger } from "@logging/logger.service";
import { ProjectResponse } from "@projects/dto/project.dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Competences, Leviers } from "@/shared/types";

@Injectable()
export class GetProjectsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async findAll(): Promise<ProjectResponse[]> {
    this.logger.debug("Finding all projects");

    const results = await this.dbService.database.query.projects.findMany({
      with: {
        collectivites: {
          with: {
            collectivite: true,
          },
        },
      },
    });

    //todo check why I need to remap collectivites
    return results.map((result) => {
      return {
        ...result,
        competences: result.competences ? (result.competences as Competences) : null,
        leviers: result.leviers ? (result.leviers as Leviers) : null,
        collectivites: result.collectivites.map((c) => c.collectivite),
      };
    });
  }

  async findOne(id: string): Promise<ProjectResponse> {
    const result = await this.dbService.database.query.projects.findFirst({
      where: eq(projects.id, id),
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
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return {
      ...result,
      competences: result.competences ? (result.competences as Competences) : null,
      leviers: result.leviers ? (result.leviers as Leviers) : null,
      collectivites: result.collectivites.map((c) => c.collectivite),
    };
  }
}
