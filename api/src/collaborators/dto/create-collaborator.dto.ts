import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum } from "class-validator";
import { PermissionType, permissionTypeEnum } from "@database/schema";

export class CreateCollaboratorResponse {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: permissionTypeEnum.enumValues })
  permissionType: PermissionType;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreateCollaboratorRequest {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: permissionTypeEnum.enumValues })
  @IsEnum(permissionTypeEnum.enumValues)
  permissionType: PermissionType;
}
