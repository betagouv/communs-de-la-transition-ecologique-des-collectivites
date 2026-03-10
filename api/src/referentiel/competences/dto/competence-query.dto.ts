import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";
import { PaginationQueryDto } from "../../shared/dto/pagination-query.dto";

export class CompetenceGroupementsQueryDto extends PaginationQueryDto {
  @ApiProperty({ required: false, description: "Code INSEE commune" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/)
  commune?: string;

  @ApiProperty({ required: false, description: "Code département" })
  @IsOptional()
  @IsString()
  departement?: string;

  @ApiProperty({ required: false, description: "Type(s) de groupement, séparés par virgules" })
  @IsOptional()
  @IsString()
  type?: string;
}
