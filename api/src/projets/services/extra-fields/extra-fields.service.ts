import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { projets, serviceExtraFields } from "@database/schema";
import { eq } from "drizzle-orm";
import { CreateProjetExtraFieldRequest, ExtraField } from "@projets/dto/extra-fields.dto";
import { IdType } from "@/shared/types";

@Injectable()
export class ExtraFieldsService {
  constructor(private readonly dbService: DatabaseService) {}

  async getExtraFieldsByProjetId(id: string, idType: IdType): Promise<ExtraField[]> {
    const projet = await this.findProjectByIdType(id, idType);

    const extraFields = await this.dbService.database
      .select({ name: serviceExtraFields.name, value: serviceExtraFields.value })
      .from(serviceExtraFields)
      .where(eq(serviceExtraFields.projetId, projet.id));

    return extraFields;
  }

  async createExtraFields(
    id: string,
    extraFieldsDto: CreateProjetExtraFieldRequest,
    idType: IdType,
  ): Promise<ExtraField[]> {
    const projet = await this.findProjectByIdType(id, idType);

    return this.dbService.database.transaction(async (tx) => {
      // todo handle conflictual update / deletion

      const updatedExtrafields = await tx
        .insert(serviceExtraFields)
        .values(
          extraFieldsDto.extraFields.map((field) => ({
            projetId: projet.id,
            name: field.name,
            value: field.value,
          })),
        )
        .returning();

      return updatedExtrafields;
    });
  }

  private async findProjectByIdType(id: string, idType: IdType) {
    const whereCondition = idType === "tetId" ? eq(projets.tetId, id) : eq(projets.id, id);

    const projet = await this.dbService.database.query.projets.findFirst({
      where: whereCondition,
    });

    if (!projet) {
      throw new NotFoundException(`Projet with ${idType} ${id} not found`);
    }

    return projet;
  }
}
