import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class DispositifQueryDto {
  @ApiProperty({ required: false, description: "Type de dispositif (ex: COT)", example: "COT" })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false, description: "Statut du dispositif", example: "Suivi du projet" })
  @IsOptional()
  @IsString()
  statut?: string;

  @ApiProperty({ required: false, description: "SIREN de l'EPCI" })
  @IsOptional()
  @IsString()
  epciSiren?: string;
}
