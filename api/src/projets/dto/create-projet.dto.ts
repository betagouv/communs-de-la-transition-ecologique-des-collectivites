import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ProjetEtapes, projetEtapesEnum, EtapeStatus, etapeStatusEnum } from "@database/schema";
import { Competences, Leviers } from "@/shared/types";
import { competences } from "@/shared/const/competences-list";
import { leviers } from "@/shared/const/leviers";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { PorteurDto } from "@projets/dto/porteur.dto";
import { Type } from "class-transformer";

export class CreateOrUpdateProjetResponse {
  @ApiProperty()
  @IsString()
  id!: string;
}

export class CreateProjetRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true, type: PorteurDto })
  @ValidateNested()
  @Type(() => PorteurDto)
  @IsOptional()
  porteur?: PorteurDto | null;

  @ApiProperty({ required: false, nullable: true, type: Number })
  @IsNumber()
  @IsOptional()
  budgetPrevisionnel?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    description: "Forecasted start date in YYYY-MM-DD format",
    example: "2024-03-01",
  })
  @IsDateString()
  dateDebutPrevisionnelle?: string | null;

  @ApiProperty({
    enum: etapeStatusEnum.enumValues,
    nullable: true,
    required: false,
    description: "Current status for the etape",
  })
  @IsOptional()
  etapeStatus?: EtapeStatus | null;

  @ApiProperty({
    enum: projetEtapesEnum.enumValues,
    nullable: true,
    required: false,
    description: "Current Etape for the project",
  })
  @IsOptional()
  etape?: ProjetEtapes | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  programme?: string | null;

  @ApiProperty({
    description: "Array of collectivite references",
    example: [
      { type: "Commune", code: "12345" },
      { type: "EPCI", code: "123456789" },
    ],
    required: true,
    type: [CollectiviteReference],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectiviteReference)
  @ArrayNotEmpty({ message: "At least one commune insee code must be provided" })
  collectivites!: CollectiviteReference[];

  @ApiProperty({
    type: String,
    enum: competences,
    isArray: true,
    required: false,
    nullable: true,
    description: "Array of competences and sous-competences",
    example: ["Santé", "Culture > Arts plastiques et photographie"],
  })
  @IsArray()
  @IsOptional()
  @IsIn(competences, { each: true })
  competences?: Competences | null;

  @ApiProperty({
    type: String,
    enum: leviers,
    isArray: true,
    required: false,
    nullable: true,
    description: "Array of leviers de la transition écologique",
  })
  @IsArray()
  @IsOptional()
  @IsIn(leviers, { each: true })
  leviers?: Leviers | null;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  externalId!: string;
}
