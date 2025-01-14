import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateProjectRequest } from "../dto/create-project.dto";
import { UpdateProjectDto } from "../dto/update-project.dto";
import { projects } from "@database/schema";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@/logging/logger.service";
import { ProjectResponse } from "../dto/project.dto";
import { eq } from "drizzle-orm";
import { CommunesService } from "./communes.service";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { Competence, CompetencesWithSousCompetences, SousCompetence } from "@/shared/types";
import { CompetencesService } from "./competences.service";

@Injectable()
export class ProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly communesService: CommunesService,
    private readonly competencesService: CompetencesService,
    private logger: CustomLogger,
  ) {}

  async create(createProjectDto: CreateProjectRequest): Promise<{ id: string }> {
    this.validateDate(createProjectDto.forecastedStartDate);

    const { competencesAndSousCompetences, ...otherFields } = createProjectDto;
    const { competences, sousCompetences } = this.competencesService.splitCompetence(competencesAndSousCompetences);

    return this.dbService.database.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projects)
        .values({
          ...otherFields,
          competences,
          sousCompetences,
        })
        .returning();

      await this.communesService.createOrUpdate(tx, createdProject.id, createProjectDto.communeInseeCodes);

      return { id: createdProject.id };
    });
  }

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

  async update(id: string, updateProjectDto: UpdateProjectDto): Promise<{ id: string }> {
    if (updateProjectDto.forecastedStartDate) {
      this.validateDate(updateProjectDto.forecastedStartDate);
    }

    const { competencesAndSousCompetences, ...otherFields } = updateProjectDto;
    const { competences, sousCompetences } = this.splitCompetence(competencesAndSousCompetences);

    return this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx
        .select({
          id: projects.id,
        })
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Project with ID ${id} not found`);
      }

      const { communeInseeCodes, ...fieldsToUpdate } = removeUndefined({
        ...otherFields,
        competences,
        sousCompetences,
      });

      if (communeInseeCodes) {
        await this.communesService.createOrUpdate(tx, id, communeInseeCodes);
      }

      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx.update(projects).set(fieldsToUpdate).where(eq(projects.id, id));
      }

      return { id: existingProject.id };
    });
  }

  remove(id: string) {
    return `This action removes a #${id} project`;
  }

  private validateDate(dateStr: string): void {
    const inputDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      throw new BadRequestException("Forecasted start date must be in the future");
    }
  }

  private splitCompetence(competencesList: CompetencesWithSousCompetences | null | undefined): {
    competences: Competence[] | null;
    sousCompetences: SousCompetence[] | null;
  } {
    if (!competencesList) {
      return { competences: null, sousCompetences: null };
    }

    const competences: Competence[] = [];
    const sousCompetences: SousCompetence[] = [];

    if (Array.isArray(competencesList)) {
      competencesList.forEach((compAndSousComp) => {
        const [mainCompetence, sousCompetence] = compAndSousComp.split("__");
        competences.push(mainCompetence as Competence);
        if (sousCompetence) {
          sousCompetences.push(sousCompetence as SousCompetence);
        }
      });
    }

    return {
      competences: competences.length > 0 ? competences : null,
      sousCompetences: sousCompetences.length > 0 ? sousCompetences : null,
    };
  }
}
