import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { ProjectStatus, projectStatusEnum } from "@database/schema";
import { CompetencesWithSousCompetences } from "@/shared/types";
import { competencesWithSousCompetences } from "@/shared/const/competences-list";

export class CreateOrUpdateProjectResponse {
  @ApiProperty()
  @IsString()
  id!: string;
}

export class CreateProjectRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  porteurCodeSiret?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  porteurReferentEmail?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  porteurReferentTelephone?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  porteurReferentPrenom?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  porteurReferentNom?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  porteurReferentFonction?: string | null;

  @ApiProperty({ required: false, nullable: true, type: Number })
  @IsNumber()
  @IsOptional()
  budget!: number;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    description: "Forecasted start date in YYYY-MM-DD format",
    example: "2024-03-01",
  })
  @IsDateString()
  forecastedStartDate!: string;

  @ApiProperty({
    enum: projectStatusEnum.enumValues,
    nullable: true,
    required: false,
    description: "Current Status for the project",
  })
  @IsOptional()
  status?: ProjectStatus | null;

  @ApiProperty({
    type: [String],
    description: "Array of INSEE codes for the communes",
    example: ["01001", "75056", "97A01"],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty({
    message: "At least one commune insee code must be provided",
  })
  communeInseeCodes!: string[];

  @ApiProperty({
    enum: competencesWithSousCompetences,
    isArray: true,
    required: false,
    nullable: true,
    description: "Array of competences and sous-competences",
  })
  @IsArray()
  @IsOptional()
  competences?: CompetencesWithSousCompetences | null;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  externalId!: string;
}
