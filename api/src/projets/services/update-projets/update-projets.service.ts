import { DatabaseService } from "@database/database.service";
import { projets } from "@database/schema";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { UpdateProjetRequest } from "@projets/dto/update-projet.dto";
import { ServiceIdentifierService } from "@projets/services/service-identifier/service-identifier.service";

@Injectable()
export class UpdateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
    private readonly serviceIdentifierService: ServiceIdentifierService,
  ) {}

  async update(id: string, updateProjectDto: UpdateProjetRequest, apiKey: string): Promise<{ id: string }> {
    const serviceIdField = this.serviceIdentifierService.getServiceIdFieldFromApiKey(apiKey);

    const { collectivites, externalId, porteur, ...otherFields } = updateProjectDto;

    return this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx.select().from(projets).where(eq(projets.id, id)).limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Projet with ID ${id} not found`);
      }

      if (existingProject[serviceIdField] !== externalId) {
        throw new ConflictException(
          `Projet with ID ${id} cannot be updated: externalId mismatch (current: ${existingProject[serviceIdField]}, requested: ${updateProjectDto.externalId})`,
        );
      }

      const fieldsToUpdate = removeUndefined({
        ...otherFields,
        [serviceIdField]: externalId,
        porteurCodeSiret: porteur?.codeSiret ?? undefined,
        porteurReferentEmail: porteur?.referentEmail ?? undefined,
        porteurReferentTelephone: porteur?.referentTelephone ?? undefined,
        porteurReferentPrenom: porteur?.referentPrenom ?? undefined,
        porteurReferentNom: porteur?.referentNom ?? undefined,
        porteurReferentFonction: porteur?.referentFonction ?? undefined,
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
