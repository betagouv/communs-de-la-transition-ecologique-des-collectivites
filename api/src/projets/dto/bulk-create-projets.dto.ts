import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { CreateProjetRequest } from "./create-projet.dto";
import { Type } from "class-transformer";

export class BulkCreateProjetsResponse {
  @ApiProperty()
  ids!: string[];
}

export class BulkCreateProjetsRequest {
  @ApiProperty({ required: true, type: CreateProjetRequest, isArray: true })
  @IsArray()
  // Both @ValidateNested and @Type are required to validate nested objects properly
  @ValidateNested({ each: true })
  @Type(() => CreateProjetRequest)
  @ArrayMinSize(1, { message: "At least one project must be provided" })
  projects!: CreateProjetRequest[];
}
