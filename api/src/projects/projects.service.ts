import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { porteurReferents, projects } from "@database/schema";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@/logging/logger.service";
import { ProjectDto } from "./dto/project.dto";
import { eq } from "drizzle-orm";

@Injectable()
export class ProjectsService {
  constructor(
    private dbService: DatabaseService,
    private logger: CustomLogger,
  ) {}

  private validateDate(dateStr: string): void {
    const inputDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      throw new BadRequestException(
        "Forecasted start date must be in the future",
      );
    }
  }

  async create(createProjectDto: CreateProjectDto): Promise<{ id: string }> {
    this.logger.debug("Creating new project", { dto: createProjectDto });

    try {
      this.validateDate(createProjectDto.forecastedStartDate);

      return await this.dbService.database.transaction(async (tx) => {
        let porteurId: string | null = null;

        if (createProjectDto.porteurReferent) {
          const existingPorteur = await tx.query.porteurReferents.findFirst({
            where: eq(
              porteurReferents.email,
              createProjectDto.porteurReferent.email,
            ),
          });

          if (existingPorteur) {
            porteurId = existingPorteur.id;
          } else {
            const [newPorteur] = await tx
              .insert(porteurReferents)
              .values({
                ...createProjectDto.porteurReferent,
              })
              .returning();
            porteurId = newPorteur.id;
          }
        }

        const [createdProject] = await tx
          .insert(projects)
          .values({
            nom: createProjectDto.nom,
            description: createProjectDto.description,
            codeSiret: createProjectDto.codeSiret,
            ...(porteurId ? { porteurReferentId: porteurId } : {}),
            budget: createProjectDto.budget,
            forecastedStartDate: createProjectDto.forecastedStartDate,
            communeInseeCodes: createProjectDto.communeInseeCodes,
            status: createProjectDto.status,
          })
          .returning();

        return { id: createdProject.id };
      });
    } catch (error) {
      this.logger.error("Failed to create project", {
        error: error.message,
        dto: createProjectDto,
      });
      throw error;
    }
  }

  async findAll(): Promise<ProjectDto[]> {
    this.logger.debug("Finding all projects");

    try {
      const results = await this.dbService.database.query.projects.findMany({
        with: {
          porteurReferent: true,
        },
        columns: {
          porteurReferentId: false,
        },
      });

      this.logger.debug(`Found ${results.length} projects`);
      return results;
    } catch (error) {
      this.logger.error("Failed to find projects", { error: error.message });
      throw error;
    }
  }

  async findOne(id: string): Promise<ProjectDto> {
    this.logger.debug("Finding project by id", { projectId: id });

    try {
      const result = await this.dbService.database.query.projects.findFirst({
        where: eq(projects.id, id),
        with: {
          porteurReferent: true,
        },
        columns: {
          porteurReferentId: false,
        },
      });

      if (!result) {
        this.logger.warn("Project not found", { projectId: id });
        throw new NotFoundException(`Project with ID ${id} not found`);
      }

      this.logger.debug("Found project", { projectId: id });
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error("Failed to find project", {
        projectId: id,
        error: error.message,
      });
      throw error;
    }
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    console.log(updateProjectDto);
    return `This action updates a #${id} project`;
  }

  remove(id: string) {
    return `This action removes a #${id} project`;
  }
}
