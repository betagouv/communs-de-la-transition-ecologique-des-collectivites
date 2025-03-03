import { DatabaseService } from "@database/database.service";
import { ConflictException, Injectable } from "@nestjs/common";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { projects } from "@database/schema";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { BulkCreateProjectsRequest } from "@projects/dto/bulk-create-projects.dto";
import { ServiceIdentifierService } from "../service-identifier/service-identifier.service";
import { eq } from "drizzle-orm";

@Injectable()
export class CreateProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
  ) {}

  async create(createProjectDto: CreateProjectRequest, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { competences, externalId, ...otherFields } = createProjectDto;

    // Check if project already exists with this externalId
    const existingProject = await this.dbService.database
      .select()
      .from(projects)
      .where(eq(projects[serviceIdField], externalId))
      .limit(1);

    if (existingProject.length > 0) {
      throw new ConflictException(`Project with ${serviceIdField} ${externalId} already exists`);
    }

    return this.dbService.database.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projects)
        .values({
          ...otherFields,
          competences,
          [serviceIdField]: externalId,
        })
        .returning();

      await this.collectivitesService.createOrUpdateRelations(tx, createdProject.id, createProjectDto.collectivitesRef);

      return { id: createdProject.id };
    });
  }

  async createBulk(bulkCreateProjectsRequest: BulkCreateProjectsRequest, apiKey: string): Promise<{ ids: string[] }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    return this.dbService.database.transaction(async (tx) => {
      const createdProjects = [];

      for (const projectDto of bulkCreateProjectsRequest.projects) {
        const { competences, collectivitesRef, externalId, ...projectFields } = projectDto;

        const existingProject = await this.dbService.database
          .select()
          .from(projects)
          .where(eq(projects[serviceIdField], externalId))
          .limit(1);

        if (existingProject.length > 0) {
          throw new ConflictException(`Project with ${serviceIdField} ${externalId} already exists`);
        }

        const [newProject] = await tx
          .insert(projects)
          .values({
            ...projectFields,
            competences,
            [serviceIdField]: externalId,
          })
          .returning({ id: projects.id });

        await this.collectivitesService.createOrUpdateRelations(tx, newProject.id, collectivitesRef);

        createdProjects.push(newProject);
      }

      return { ids: createdProjects.map((p) => p.id) };
    });
  }
}
