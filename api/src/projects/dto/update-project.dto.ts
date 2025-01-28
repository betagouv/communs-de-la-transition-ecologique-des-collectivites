import { CreateProjectRequest } from "./create-project.dto";
import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateProjectDto extends PartialType(CreateProjectRequest) {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;
}
