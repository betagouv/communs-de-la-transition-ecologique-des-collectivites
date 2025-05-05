import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class ExtraField {
  @ApiProperty({ description: "Name of the extra field" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Value of the extra field" })
  @IsString()
  value!: string;
}

export class CreateProjetExtraFieldRequest {
  @ApiProperty({
    description: "Array of extra field names, values, and labels",
    type: [ExtraField],
  })
  @IsArray()
  extraFields!: ExtraField[];
}
