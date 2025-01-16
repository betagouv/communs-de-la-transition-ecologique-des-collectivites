import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { CreateProjectRequest } from "./create-project.dto";
import { Type } from "class-transformer";

export class BulkCreateProjectsResponse {
  @ApiProperty()
  ids!: string[];
}

export class BulkCreateProjectsRequest {
  @ApiProperty({ required: true, type: CreateProjectRequest, isArray: true })
  @IsArray()
  // Both @ValidateNested and @Type are required to validate nested objects properly
  @ValidateNested({ each: true })
  @Type(() => CreateProjectRequest)
  @ArrayMinSize(1, { message: "At least one project must be provided" })
  projects!: CreateProjectRequest[];
}
