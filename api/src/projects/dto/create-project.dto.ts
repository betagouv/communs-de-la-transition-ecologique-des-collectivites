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
import {
  ProjectStatus,
  projectStatusEnum,
  competencesEnum,
  sousCompetencesEnum,
  Competences,
  SousCompetences,
} from "@database/schema";

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

  //need this against ApiPropertyOptional to ensure proper generated types
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
    enum: competencesEnum.enumValues,
    nullable: true,
  })
  @IsEnum(competencesEnum.enumValues)
  @IsOptional()
  competences?: Competences | null;

  @ApiPropertyOptional({
    enum: sousCompetencesEnum.enumValues,
    nullable: true,
  })
  @IsEnum(sousCompetencesEnum.enumValues)
  @IsOptional()
  sousCompetences?: SousCompetences | null;
}
