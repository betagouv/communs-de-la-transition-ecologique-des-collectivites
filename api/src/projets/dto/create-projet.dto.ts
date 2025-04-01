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
import { PhaseStatut, phaseStatutEnum, ProjetPhases, projetPhasesEnum } from "@database/schema";
import { Competences, Leviers } from "@/shared/types";
import { competenceCodes } from "@/shared/const/competences-list-v2";
import { leviers } from "@/shared/const/leviers";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { PorteurDto } from "@projets/dto/porteur.dto";
import { Type } from "class-transformer";
import {
  PhaseStatutRequiresPhase,
  SetEnCoursIfPhaseIsProvidedButNoPhaseStatut,
} from "@projets/decorators/phase-decorators";

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
  @IsOptional()
  @IsDateString()
  dateDebutPrevisionnelle?: string | null;

  @ApiProperty({
    enum: projetPhasesEnum.enumValues,
    nullable: true,
    required: false,
    description: "Current Phase for the project",
  })
  @IsIn(projetPhasesEnum.enumValues)
  @IsOptional()
  phase?: ProjetPhases | null;

  @ApiProperty({
    enum: phaseStatutEnum.enumValues,
    nullable: true,
    required: false,
    description: "Current phase status for the phase",
  })
  @IsOptional()
  @IsIn(phaseStatutEnum.enumValues)
  @PhaseStatutRequiresPhase({ message: "Cannot specify phaseStatut without a phase" })
  @SetEnCoursIfPhaseIsProvidedButNoPhaseStatut()
  phaseStatut?: PhaseStatut | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  programme?: string | null;

  @ApiProperty({
    description: "Array of collectivite references",
    example: [
      { type: "Commune", code: "44104" },
      { type: "EPCI", code: "200000438" },
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
    nullable: true,
    type: String,
    enum: competenceCodes,
    description: "Array of competences and sous-competences",
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsIn(competenceCodes, { each: true })
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
