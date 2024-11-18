import { Injectable } from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { projects } from "../database/schema";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ProjectsService {
  constructor(private dbService: DatabaseService) {}

  async create(createProjectDto: CreateProjectDto) {
    const [newProject] = await this.dbService.database
      .insert(projects)
      .values(createProjectDto)
      .returning();
    return newProject;
  }

  async findAll() {
    return this.dbService.database.select().from(projects);
  }

  async findOne(id: string) {
    const [project] = await this.dbService.database
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project || null;
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    console.log(updateProjectDto);
    return `This action updates a #${id} project`;
  }

  remove(id: string) {
    return `This action removes a #${id} project`;
  }
}
