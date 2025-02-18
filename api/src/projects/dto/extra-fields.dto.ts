import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

class ExtraField {
  @ApiProperty({ description: "Name of the extra field" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Value of the extra field" })
  @IsString()
  value!: string;
}

export class ProjectExtraFieldsResponse {
  @ApiProperty({
    description: "Array of extra field names, values, and labels",
    example: [{ name: "surface", value: "100" }],
    type: [ExtraField],
  })
  @IsArray()
  extraFields!: ExtraField[];
}

export class CreateProjectExtraFieldRequest {
  @ApiProperty({
    description: "Array of extra field names, values, and labels",
    example: [{ name: "surface", value: "100" }],
    type: [ExtraField],
  })
  @IsArray()
  extraFields!: ExtraField[];
}
