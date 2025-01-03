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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  porteurCodeSiret?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  porteurReferentEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  porteurReferentTelephone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  porteurReferentPrenom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  porteurReferentNom?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  porteurReferentFonction?: string;

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
}
