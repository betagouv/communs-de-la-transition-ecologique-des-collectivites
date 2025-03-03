import { DatabaseService } from "@database/database.service";
import { projects } from "@database/schema";
import { UpdateProjectDto } from "@projects/dto/update-project.dto";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ServiceIdentifierService } from "@projects/services/service-identifier/service-identifier.service";
import { CollectivitesService } from "../collectivites/collectivites.service";

@Injectable()
export class UpdateProjectsService {
  constructor(
    private dbService: DatabaseService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
    private readonly collectivitesService: CollectivitesService,
  ) {}

  async update(id: string, updateProjectDto: UpdateProjectDto, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { externalId, collectivitesRef, ...otherFields } = updateProjectDto;

    return this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Project with ID ${id} not found`);
      }

      // Check if project belongs to the service making the update
      if (existingProject[serviceIdField] !== externalId) {
        throw new ConflictException(
          `Project with ID ${id} cannot be updated: externalId mismatch (current: ${existingProject[serviceIdField]}, requested: ${externalId})`,
        );
      }

      const fieldsToUpdate = removeUndefined({
        ...otherFields,
        [serviceIdField]: externalId,
      });

      if (collectivitesRef !== undefined && collectivitesRef.length > 0) {
        await this.collectivitesService.createOrUpdateRelations(tx, id, collectivitesRef);
      }

      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx.update(projects).set(fieldsToUpdate).where(eq(projects.id, id));
      }

      return { id };
    });
  }
}
