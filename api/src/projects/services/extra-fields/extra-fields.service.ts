import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { serviceExtraFields } from "@database/schema";
import { eq } from "drizzle-orm";
import { CreateProjectExtraFieldRequest, ProjectExtraFieldsResponse } from "@projects/dto/extra-fields.dto";

@Injectable()
export class ExtraFieldsService {
  constructor(private readonly dbService: DatabaseService) {}

  async getExtraFieldsByProjectId(projectId: string): Promise<ProjectExtraFieldsResponse> {
    const extraFields = await this.dbService.database
      .select({ name: serviceExtraFields.name, value: serviceExtraFields.value })
      .from(serviceExtraFields)
      .where(eq(serviceExtraFields.projectId, projectId));

    return { extraFields };
  }

  async createExtraFields(
    projectId: string,
    extraFieldsDto: CreateProjectExtraFieldRequest,
  ): Promise<ProjectExtraFieldsResponse> {
    return this.dbService.database.transaction(async (tx) => {
      // todo handle conflictual update / deletion

      const updatedExtrafields = await tx
        .insert(serviceExtraFields)
        .values(
          extraFieldsDto.extraFields.map((field) => ({
            projectId,
            name: field.name,
            value: field.value,
          })),
        )
        .returning();

      return { extraFields: updatedExtrafields };
    });
  }
}
