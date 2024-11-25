import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { projects } from "@database/schema";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@/logging/logger.service";
import { ProjectDto } from "./dto/project.dto";
import { hashEmail } from "@projects/utils";

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

  async create(createProjectDto: CreateProjectDto): Promise<ProjectDto> {
    this.logger.debug("Creating new project", { dto: createProjectDto });

    try {
      this.validateDate(createProjectDto.forecastedStartDate);

      return await this.dbService.database.transaction(async (tx) => {
        // fake insee codes for now till we have a real source
        const communes = ["01001", "75056", "97A01"];

        const [project] = await tx
          .insert(projects)
          .values({
            nom: createProjectDto.nom,
            description: createProjectDto.description,
            codeSiret: createProjectDto.codeSiret,
            porteurEmailHash: hashEmail(createProjectDto.porteurEmail),
            communeInseeCodes: communes,
            budget: createProjectDto.budget,
            forecastedStartDate: createProjectDto.forecastedStartDate,
            status: createProjectDto.status,
          })
          .returning();

        return project;
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
    return this.dbService.database.select().from(projects);
  }

  async findOne(id: string): Promise<ProjectDto> {
    const project = await this.dbService.database.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.id, id),
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    console.log(updateProjectDto);
    return `This action updates a #${id} project`;
  }

  remove(id: string) {
    return `This action removes a #${id} project`;
  }
}
