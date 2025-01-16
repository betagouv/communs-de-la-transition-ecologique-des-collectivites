import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray } from "class-validator";
import { CreateProjectRequest } from "./create-project.dto";

export class BulkCreateProjectsResponse {
  @ApiProperty()
  ids!: string[];
}

export class BulkCreateProjectsRequest {
  @ApiProperty({ required: true, type: CreateProjectRequest, isArray: true })
  @IsArray()
  @ArrayMinSize(1, { message: "At least one project must be provided" })
  projects!: CreateProjectRequest[];
}
