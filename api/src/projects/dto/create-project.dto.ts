import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
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

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
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

  @ApiProperty({ required: false, nullable: true, type: Number })
  @IsNumber()
  @IsOptional()
  budget!: number;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsDateString()
  @IsOptional()
  forecastedStartDate!: string;

  @ApiPropertyOptional({
    enum: projectStatusEnum.enumValues,
    nullable: true,
    description: "Status specific to the service type",
  })
  @IsOptional()
  status?: ProjectStatus | null;

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
