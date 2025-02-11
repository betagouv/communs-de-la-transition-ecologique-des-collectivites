import { ApiProperty } from "@nestjs/swagger";
import { IsArray } from "class-validator";

export class ProjectExtraFieldsResponse {
  @ApiProperty({
    description: "Array of extra field names and their values",
    example: [{ fieldName: "surface", fieldValue: "100" }],
    nullable: true,
  })
  @IsArray()
  extraFields!: { fieldName: string; fieldValue: string | null }[];
}

export class CreateProjectExtraFieldRequest {
  @ApiProperty({
    description: "Array of extra field names and their values",
    example: [{ fieldName: "surface", fieldValue: "100" }],
  })
  @IsArray()
  extraFields!: { fieldName: string; fieldValue: string }[];
}
