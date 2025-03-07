import { DatabaseService } from "@database/database.service";
import { ConflictException, Injectable } from "@nestjs/common";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { projets } from "@database/schema";
import { eq } from "drizzle-orm";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { ServiceIdentifierService } from "@projets/services/service-identifier/service-identifier.service";
import { BulkCreateProjetsRequest } from "@projets/dto/bulk-create-projets.dto";

@Injectable()
export class CreateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
  ) {}

  async create(createProjectDto: CreateProjetRequest, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { competences, externalId, ...otherFields } = createProjectDto;

    // Check if project already exists with this externalId
    const existingProject = await this.dbService.database
      .select()
      .from(projets)
      .where(eq(projets[serviceIdField], externalId))
      .limit(1);

    if (existingProject.length > 0) {
      throw new ConflictException(`Projet with ${serviceIdField} ${externalId} already exists`);
    }

    return this.dbService.database.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projets)
        .values({
          ...otherFields,
          competences,
          [serviceIdField]: externalId,
        })
        .returning();

      await this.collectivitesService.createOrUpdateRelations(tx, createdProject.id, createProjectDto.collectivites);

      return { id: createdProject.id };
    });
  }

  async createBulk(bulkCreateProjectsRequest: BulkCreateProjetsRequest, apiKey: string): Promise<{ ids: string[] }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    return this.dbService.database.transaction(async (tx) => {
      const createdProjects = [];

      for (const projectDto of bulkCreateProjectsRequest.projects) {
        const { competences, collectivites, externalId, ...projectFields } = projectDto;

        const existingProject = await this.dbService.database
          .select()
          .from(projets)
          .where(eq(projets[serviceIdField], externalId))
          .limit(1);

        if (existingProject.length > 0) {
          throw new ConflictException(`Projet with ${serviceIdField} ${externalId} already exists`);
        }

        const [newProject] = await tx
          .insert(projets)
          .values({
            ...projectFields,
            competences,
            [serviceIdField]: externalId,
          })
          .returning({ id: projets.id });

        await this.collectivitesService.createOrUpdateRelations(tx, newProject.id, collectivites);

        createdProjects.push(newProject);
      }

      return { ids: createdProjects.map((p) => p.id) };
    });
  }
}
