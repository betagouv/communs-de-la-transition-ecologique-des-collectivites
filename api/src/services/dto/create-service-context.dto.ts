import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";
import { ProjectStatus, projectStatusEnum } from "@database/schema";
import { CompetencesWithSousCompetences } from "@/shared/types";
import { competencesWithSousCompetences } from "@/shared/const/competences-list";

export class CreateServiceContextDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({
    enum: competencesWithSousCompetences,
    isArray: true,
    required: true,
    description: "Array of competences and sous-competences",
  })
  @IsArray()
  competencesAndSousCompetences!: CompetencesWithSousCompetences;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: "Custom logo URL for the service in this context",
    example: "https://example.com/custom-logo.png",
    required: false,
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  logoUrl?: string;

  @ApiProperty({
    description: "Custom redirection URL for the service in this context",
    example: "https://service.example.com/specific-page",
    required: false,
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  redirectionUrl?: string;

  @ApiProperty({
    description: "Custom label for the redirection button",
    example: "Access Climate Tools",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  redirectionLabel?: string;

  @ApiProperty({
    description: "Custom label for extending/expanding the service details",
    example: "Show climate data",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  extendLabel?: string;

  @ApiProperty({
    enum: projectStatusEnum.enumValues,
    nullable: true,
    required: false,
    description: "Project status for which the serviceContext applies",
  })
  @IsOptional()
  status?: ProjectStatus | null;
}
