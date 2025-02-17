// this name needs to be different from ExtraField dto
// in project.dto.ts to avoid conflict in openapi types generation
import { ApiProperty } from "@nestjs/swagger";

export class ExtraFieldConfig {
  @ApiProperty({ description: "Name of the extra field" })
  name!: string;

  @ApiProperty({ description: "Value of the extra field" })
  label!: string;
}
