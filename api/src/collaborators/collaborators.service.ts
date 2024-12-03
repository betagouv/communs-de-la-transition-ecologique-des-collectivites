import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService, Tx } from "@database/database.service";
import {
  PermissionType,
  projectCollaborators,
  projects,
} from "@database/schema";
import { and, eq } from "drizzle-orm";
import { CreateCollaboratorDto } from "@/collaborators/dto/add-collaborator.dto";

@Injectable()
export class CollaboratorsService {
  constructor(private dbService: DatabaseService) {}

  async create(
    tx: Tx,
    projectId: string,
    { email, permissionType }: CreateCollaboratorDto,
  ): Promise<string> {
    await this.validateProjectExistence(tx, projectId);

    await tx
      .insert(projectCollaborators)
      .values({
        projectId,
        email,
        permissionType,
      })
      .onConflictDoUpdate({
        target: [projectCollaborators.projectId, projectCollaborators.email],
        set: {
          permissionType,
        },
      })
      .returning();

    return `Permission updated/created for ${email} on project ${projectId}`;
  }

  async hasPermission(
    projectId: string,
    userEmail: string,
    requiredPermission: PermissionType,
  ): Promise<boolean> {
    return await this.dbService.database.transaction(async (tx) => {
      await this.validateProjectExistence(tx, projectId);

      const collaborator = await tx
        .select()
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.email, userEmail),
          ),
        )
        .limit(1);

      if (collaborator.length === 0) {
        return false;
      }

      return (
        collaborator[0].permissionType === "EDIT" ||
        collaborator[0].permissionType === requiredPermission
      );
    });
  }

  private async validateProjectExistence(
    tx: Tx,
    projectId: string,
  ): Promise<void> {
    const project = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project.length) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
  }
}
