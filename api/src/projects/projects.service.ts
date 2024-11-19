import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { projects } from "@database/schema";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@/logging/logger.service";

@Injectable()
export class ProjectsService {
  constructor(
    private dbService: DatabaseService,
    private logger: CustomLogger,
  ) {}

  async create(createProjectDto: CreateProjectDto) {
    this.logger.debug("Creating new project", { dto: createProjectDto });

    try {
      const [newProject] = await this.dbService.database
        .insert(projects)
        .values(createProjectDto)
        .returning();

      this.logger.log("Project created successfully", {
        projectId: newProject.id,
      });

      return newProject;
    } catch (error) {
      this.logger.error("Failed to create project", {
        error: error.message,
        dto: createProjectDto,
      });
      throw error;
    }
  }

  async findAll() {
    return this.dbService.database.select().from(projects);
  }

  async findOne(id: string) {
    const [project] = await this.dbService.database
      .select()
      .from(projects)
      .where(eq(projects.id, id));

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
