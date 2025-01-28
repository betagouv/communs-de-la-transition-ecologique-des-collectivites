import { DatabaseService } from "@database/database.service";
import { Injectable } from "@nestjs/common";
import { CommunesService } from "../communes/communes.service";
import { projects } from "@database/schema";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { CompetencesService } from "@projects/services/competences/competences.service";
import { BulkCreateProjectsRequest } from "@projects/dto/bulk-create-projects.dto";
import { ServiceIdentifierService } from "../service-identifier/service-identifier.service";

@Injectable()
export class CreateProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly competencesService: CompetencesService,
    private readonly communesService: CommunesService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
  ) {}

  async create(createProjectDto: CreateProjectRequest, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { competencesAndSousCompetences, serviceId, ...otherFields } = createProjectDto;
    const { competences, sousCompetences } = this.competencesService.splitCompetence(competencesAndSousCompetences);

    return this.dbService.database.transaction(async (tx) => {
      const [createdProject] = await tx
        .insert(projects)
        .values({
          ...otherFields,
          competences,
          sousCompetences,
          [serviceIdField]: serviceId,
        })
        .returning();

      await this.communesService.createOrUpdate(tx, createdProject.id, createProjectDto.communeInseeCodes);

      return { id: createdProject.id };
    });
  }

  async createBulk(bulkCreateProjectsRequest: BulkCreateProjectsRequest, apiKey: string): Promise<{ ids: string[] }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    return this.dbService.database.transaction(async (tx) => {
      const createdProjects = [];

      for (const projectDto of bulkCreateProjectsRequest.projects) {
        const { competencesAndSousCompetences, communeInseeCodes, serviceId, ...projectFields } = projectDto;
        const { competences, sousCompetences } = this.competencesService.splitCompetence(competencesAndSousCompetences);

        const [newProject] = await tx
          .insert(projects)
          .values({
            ...projectFields,
            competences,
            sousCompetences,
            [serviceIdField]: serviceId,
          })
          .returning({ id: projects.id });

        await this.communesService.createOrUpdate(tx, newProject.id, communeInseeCodes);

        createdProjects.push(newProject);
      }

      return { ids: createdProjects.map((p) => p.id) };
    });
  }
}
