import { Inject, Injectable } from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { projects } from "../database/schema";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../database/schema";
import { DATABASE } from "../database/database.module";

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private readonly database: NodePgDatabase<typeof schema>,
  ) {}

  async create(createProjectDto: CreateProjectDto) {
    const [newProject] = await this.database
      .insert(projects)
      .values(createProjectDto)
      .returning();
    return newProject;
  }

  async findAll() {
    return await this.database.select().from(projects);
  }

  async findOne(id: string) {
    const [project] = await this.database
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
