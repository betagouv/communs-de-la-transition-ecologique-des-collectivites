import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { mecProjetsOperationnels, projets, serviceExtraFields, tetFichesAction } from "@database/schema";
import { eq } from "drizzle-orm";
import { CreateProjetExtraFieldRequest, ExtraField } from "@projets/dto/extra-fields.dto";
import { IdType } from "@/shared/types";
import { CustomLogger } from "@logging/logger.service";

@Injectable()
export class ExtraFieldsService {
  constructor(
    private readonly dbService: DatabaseService,
    private readonly logger: CustomLogger,
  ) {}

  async getExtraFieldsByProjetId(id: string, idType: IdType): Promise<ExtraField[]> {
    const projet = await this.findProjetByIdType(id, idType);

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
    const projet = await this.findProjetByIdType(id, idType);

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

  private async findProjetByIdType(id: string, idType: IdType): Promise<{ id: string }> {
    const whereCondition = idType === "tetId" ? eq(projets.tetId, id) : eq(projets.id, id);

    const projet = await this.dbService.database.query.projets.findFirst({
      where: whereCondition,
    });

    if (projet) {
      return projet;
    }

    if (idType === "communId") {
      // Fallback to data_mec.projets_operationnels
      this.logger.warn("Falling back to data_mec for extra-fields project lookup", { id });
      const [mecProjet] = await this.dbService.database
        .select({ id: mecProjetsOperationnels.id })
        .from(mecProjetsOperationnels)
        .where(eq(mecProjetsOperationnels.id, id));

      if (mecProjet) {
        return { id: mecProjet.id };
      }

      // Fallback to data_tet.fiches_action
      this.logger.warn("Falling back to data_tet for extra-fields project lookup", { id });
      const [tetFiche] = await this.dbService.database
        .select({ id: tetFichesAction.id })
        .from(tetFichesAction)
        .where(eq(tetFichesAction.id, id));

      if (tetFiche) {
        return { id: tetFiche.id };
      }
    }

    throw new NotFoundException(`Projet with ${idType} ${id} not found`);
  }
}
