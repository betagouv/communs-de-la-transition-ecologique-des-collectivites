import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";
import { CollaboratorsPermissionGuard } from "@/collaborators/collaborators.permission.guard";

export function RequiresCollaboratorsPermission() {
  return applyDecorators(
    UseGuards(CollaboratorsPermissionGuard),
    ApiHeader({
      name: "X-User-Email",
      description: "Email of the user making the request",
      required: true,
      example: "user@example.com",
    }),
  );
}
