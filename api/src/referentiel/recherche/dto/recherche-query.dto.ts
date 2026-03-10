import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class RechercheQueryDto {
  @ApiProperty({ description: "Terme de recherche" })
  @IsString()
  @IsNotEmpty()
  q!: string;

  @ApiProperty({ required: false, enum: ["commune", "groupement"], description: "Filtrer par famille" })
  @IsOptional()
  @IsString()
  @IsIn(["commune", "groupement"])
  famille?: string;

  @ApiProperty({ required: false, default: 5, description: "Max résultats par famille" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}
