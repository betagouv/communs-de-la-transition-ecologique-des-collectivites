import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

class ExtraField {
  @ApiProperty({ description: "Name of the extra field" })
  @IsString()
  fieldName!: string;

  @ApiProperty({ description: "Value of the extra field" })
  @IsString()
  fieldValue!: string;
}

export class ProjectExtraFieldsResponse {
  @ApiProperty({
    description: "Array of extra field names and their values",
    example: [{ fieldName: "surface", fieldValue: "100" }],
    type: [ExtraField],
  })
  @IsArray()
  extraFields!: ExtraField[];
}

export class CreateProjectExtraFieldRequest {
  @ApiProperty({
    description: "Array of extra field names and their values",
    example: [{ fieldName: "surface", fieldValue: "100" }],
    type: [ExtraField],
  })
  @IsArray()
  extraFields!: ExtraField[];
}
