import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum } from "class-validator";
import { PermissionType, permissionTypeEnum } from "@database/schema";

export class CreateCollaboratorDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: [permissionTypeEnum.enumValues] })
  @IsEnum([permissionTypeEnum.enumValues])
  permissionType: PermissionType;
}
