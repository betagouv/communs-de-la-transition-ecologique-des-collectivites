import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class PorteurDto {
  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  codeSiret?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  referentEmail?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  referentTelephone?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  referentPrenom?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  referentNom?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  referentFonction?: string | null;
}
