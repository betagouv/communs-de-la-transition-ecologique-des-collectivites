import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { ProjectStatus, projectStatusEnum } from "@database/schema";
import { competencesWithSousCompetences } from "@/shared/const/competences-list";
import { CompetenceWithSousCompetence } from "@/shared/types";

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string;

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

  @ApiProperty()
  @IsNumber()
  budget!: number;

  @ApiProperty({
    description: "Forecasted start date in YYYY-MM-DD format",
    example: "2024-03-01",
  })
  @IsDateString(
    {},
    {
      message: "Date must be in YYYY-MM-DD format (e.g., 2024-03-01)",
    },
  )
  forecastedStartDate!: string;

  @ApiProperty({
    enum: projectStatusEnum.enumValues,
    description: "Status specific to the service type",
  })
  @IsEnum(projectStatusEnum.enumValues)
  status!: ProjectStatus;

  @ApiProperty({
    type: [String],
    description: "Array of INSEE codes for the communes",
    example: ["01001", "75056", "97A01"],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty({
    message: "At least one commune insee code must be provided",
  })
  communeInseeCodes!: string[];

  @ApiPropertyOptional({
    enum: competencesWithSousCompetences,
    isArray: true,
    nullable: true,
    description: "Array of competences and sous-competences",
  })
  @IsArray()
  @IsOptional()
  competencesAndSousCompetences?: CompetenceWithSousCompetence[] | null;
}
