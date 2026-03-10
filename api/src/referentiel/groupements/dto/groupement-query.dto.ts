import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";
import { PaginationQueryDto } from "../../shared/dto/pagination-query.dto";

export class GroupementQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, description: "Recherche par nom (autocomplete)" })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ required: false, description: "SIREN (9 chiffres)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/)
  siren?: string;

  @ApiProperty({ required: false, description: "SIRET (9 premiers chiffres → SIREN)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/)
  siret?: string;

  @ApiProperty({ required: false, description: "Type(s) séparés par virgules (ex: CA,CC,SIVU)" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false, description: "Code département" })
  @IsOptional()
  @IsString()
  departement?: string;

  @ApiProperty({ required: false, description: "Code compétence Banatic" })
  @IsOptional()
  @IsString()
  competence?: string;

  @ApiProperty({ required: false, description: "Code INSEE commune (groupements couvrant cette commune)" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  commune?: string;
}
