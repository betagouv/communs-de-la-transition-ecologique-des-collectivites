import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";
import { PaginationQueryDto } from "../../shared/dto/pagination-query.dto";

export class CommuneQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, description: "Recherche par nom (autocomplete)" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ required: false, description: "Code INSEE (5 chiffres)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  codeInsee?: string;

  @ApiProperty({ required: false, description: "SIREN (9 chiffres)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  siren?: string;

  @ApiProperty({ required: false, description: "Code département" })
  @IsOptional()
  @IsString()
  codeDepartement?: string;

  @ApiProperty({ required: false, description: "SIREN de l'EPCI" })
  @IsOptional()
  @IsString()
  codeEpci?: string;
}
