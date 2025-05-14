import { DatabaseService } from "@database/database.service";
import { projets } from "@database/schema";
import { removeUndefined } from "@/shared/utils/remove-undefined";
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { CollectivitesService } from "../collectivites/collectivites.service";
import { UpdateProjetRequest } from "@projets/dto/update-projet.dto";

@Injectable()
export class UpdateProjetsService {
  constructor(
    private dbService: DatabaseService,
    private readonly collectivitesService: CollectivitesService,
  ) {}

  async update(id: string, updateProjectDto: UpdateProjetRequest): Promise<{ id: string }> {
    const { collectivites, porteur, ...otherFields } = updateProjectDto;

    return this.dbService.database.transaction(async (tx) => {
      const [existingProject] = await tx.select().from(projets).where(eq(projets.id, id)).limit(1);

      if (!existingProject) {
        throw new NotFoundException(`Projet with ID ${id} not found`);
      }

      const fieldsToUpdate = removeUndefined({
        ...otherFields,
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
