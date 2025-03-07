import { DatabaseService } from "@database/database.service";
import { projets } from "@database/schema";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { UpdateProjetDto } from "@projets/dto/update-projet.dto";
import { ServiceIdentifierService } from "@projets/services/service-identifier/service-identifier.service";

@Injectable()
export class UpdateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
    private readonly collectivitesService: CollectivitesService,
  ) {}

  async update(id: string, updateProjectDto: UpdateProjetDto, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { externalId, collectivites, ...otherFields } = updateProjectDto;

    return this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx.select().from(projets).where(eq(projets.id, id)).limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Projet with ID ${id} not found`);
      }

      // Check if project belongs to the service making the update
      if (existingProject[serviceIdField] !== externalId) {
        throw new ConflictException(
          `Projet with ID ${id} cannot be updated: externalId mismatch (current: ${existingProject[serviceIdField]}, requested: ${externalId})`,
        );
      }

      const fieldsToUpdate = removeUndefined({
        ...otherFields,
        [serviceIdField]: externalId,
      });

      if (collectivites !== undefined && collectivites.length > 0) {
        await this.collectivitesService.createOrUpdateRelations(tx, id, collectivites);
      }

      if (Object.keys(fieldsToUpdate).length > 0) {
        await tx.update(projets).set(fieldsToUpdate).where(eq(projets.id, id));
      }

      return { id };
    });
  }
}
