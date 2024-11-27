import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateProjectDto } from "../dto/create-project.dto";
import { UpdateProjectDto } from "../dto/update-project.dto";
import { projects, projectsToCommunes } from "@database/schema";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@/logging/logger.service";
import { ProjectDto } from "../dto/project.dto";
import { eq } from "drizzle-orm";
import { CommunesService } from "./communes.service";
import { PorteurReferentsService } from "@projects/services/porteur-referents.service";

@Injectable()
export class ProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly communesService: CommunesService,
    private readonly porteurReferentsService: PorteurReferentsService,
    private logger: CustomLogger,
  ) {}

  async create(createProjectDto: CreateProjectDto): Promise<{ id: string }> {
    try {
      this.validateDate(createProjectDto.forecastedStartDate);

      return await this.dbService.database.transaction(async (tx) => {
        const porteurId = await this.porteurReferentsService.findOrCreate(
          tx,
          createProjectDto.porteurReferent,
        );

        const communes = await this.communesService.findOrCreateMany(
          tx,
          createProjectDto.communeInseeCodes,
        );

        const [createdProject] = await tx
          .insert(projects)
          .values({
            nom: createProjectDto.nom,
            description: createProjectDto.description,
            codeSiret: createProjectDto.codeSiret,
            ...(porteurId ? { porteurReferentId: porteurId } : {}),
            budget: createProjectDto.budget,
            forecastedStartDate: createProjectDto.forecastedStartDate,
            status: createProjectDto.status,
          })
          .returning();

        // Create project-commune relationships
        await tx.insert(projectsToCommunes).values(
          communes.map((commune) => ({
            projectId: createdProject.id,
            communeId: commune.id,
          })),
        );

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

    const results = await this.dbService.database.query.projects.findMany({
      with: {
        porteurReferent: true,
        communes: {
          with: {
            commune: true,
          },
        },
      },
      columns: {
        porteurReferentId: false,
      },
    });

    return results.map((result) => ({
      ...result,
      communes: result.communes.map((c) => c.commune),
    }));
  }

  async findOne(id: string): Promise<ProjectDto> {
    const result = await this.dbService.database.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        porteurReferent: true,
        communes: {
          with: {
            commune: true,
          },
        },
      },
      columns: {
        porteurReferentId: false,
      },
    });

    if (!result) {
      this.logger.warn("Project not found", { projectId: id });
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return {
      ...result,
      communes: result.communes.map((c) => c.commune),
    };
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    console.log(updateProjectDto);
    return `This action updates a #${id} project`;
  }

  remove(id: string) {
    return `This action removes a #${id} project`;
  }

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
}
