import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { CollaboratorsService } from "@/collaborators/collaborators.service";
import { PermissionType } from "@database/schema";

@Injectable()
export class CollaboratorsPermissionGuard implements CanActivate {
  constructor(private collaboratorService: CollaboratorsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const projectId = request.params.id;
    const userEmail = request.headers["x-user-email"];

    if (!userEmail) {
      throw new BadRequestException(
        "Missing user email in x-user-email header",
      );
    }

    const requiredPermission: PermissionType =
      request.method === "GET" ? "VIEW" : "EDIT";

    const hasPermission = await this.collaboratorService.hasPermission(
      projectId,
      userEmail,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}