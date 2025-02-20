import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { projects, serviceExtraFields } from "@database/schema";
import { eq } from "drizzle-orm";
import { CreateProjectExtraFieldRequest, ProjectExtraFieldsResponse } from "@projects/dto/extra-fields.dto";

@Injectable()
export class ExtraFieldsService {
  constructor(private readonly dbService: DatabaseService) {}

  async getExtraFieldsByProjectId(projectId: string): Promise<ProjectExtraFieldsResponse> {
    await this.throwIfProjectIsNotFound(projectId);

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
    await this.throwIfProjectIsNotFound(projectId);

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

  private async throwIfProjectIsNotFound(projectId: string) {
    const project = await this.dbService.database.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
  }
}
