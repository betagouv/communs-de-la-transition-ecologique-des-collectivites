import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
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
    projectId: string,
    { email, permissionType }: CreateCollaboratorDto,
  ): Promise<string> {
    await this.validateProjectExistence(projectId);

    const existingCollaborator = await this.dbService.database
      .select()
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.projectId, projectId),
          eq(projectCollaborators.email, email),
        ),
      )
      .limit(1);

    if (existingCollaborator.length > 0) {
      throw new ConflictException(
        `Collaborator ${email} already exists on project ${projectId}`,
      );
    }

    await this.dbService.database.insert(projectCollaborators).values({
      projectId,
      email,
      permissionType: permissionType,
    });

    return `permission created for ${email} on project ${projectId}`;
  }

  async hasPermission(
    projectId: string,
    userEmail: string,
    requiredPermission: PermissionType,
  ): Promise<boolean> {
    await this.validateProjectExistence(projectId);

    const collaborator = await this.dbService.database
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
  }

  private async validateProjectExistence(projectId: string): Promise<void> {
    const project = await this.dbService.database
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project.length) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
  }
}
