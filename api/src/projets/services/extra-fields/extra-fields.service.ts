import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { projets, serviceExtraFields } from "@database/schema";
import { eq } from "drizzle-orm";
import { CreateProjetExtraFieldRequest, ProjetExtraFieldsResponse } from "@projets/dto/extra-fields.dto";

@Injectable()
export class ExtraFieldsService {
  constructor(private readonly dbService: DatabaseService) {}

  async getExtraFieldsByProjetId(projetId: string): Promise<ProjetExtraFieldsResponse> {
    await this.throwIfProjectIsNotFound(projetId);

    const extraFields = await this.dbService.database
      .select({ name: serviceExtraFields.name, value: serviceExtraFields.value })
      .from(serviceExtraFields)
      .where(eq(serviceExtraFields.projetId, projetId));

    return { extraFields };
  }

  async createExtraFields(
    projetId: string,
    extraFieldsDto: CreateProjetExtraFieldRequest,
  ): Promise<ProjetExtraFieldsResponse> {
    await this.throwIfProjectIsNotFound(projetId);

    return this.dbService.database.transaction(async (tx) => {
      // todo handle conflictual update / deletion

      const updatedExtrafields = await tx
        .insert(serviceExtraFields)
        .values(
          extraFieldsDto.extraFields.map((field) => ({
            projetId,
            name: field.name,
            value: field.value,
          })),
        )
        .returning();

      return { extraFields: updatedExtrafields };
    });
  }

  private async throwIfProjectIsNotFound(projetId: string) {
    const projet = await this.dbService.database.query.projets.findFirst({
      where: eq(projets.id, projetId),
    });

    if (!projet) {
      throw new NotFoundException(`Projet with ID ${projetId} not found`);
    }
  }
}
