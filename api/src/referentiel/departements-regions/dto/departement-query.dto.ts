import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class DepartementQueryDto {
  @ApiPropertyOptional({ description: "Code INSEE de la région", example: "53" })
  @IsOptional()
  @IsString()
  codeRegion?: string;
}
