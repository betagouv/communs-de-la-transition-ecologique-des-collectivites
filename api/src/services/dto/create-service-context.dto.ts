import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsIn, IsOptional, IsString, IsUrl, ValidateIf, IsBoolean } from "class-validator";
import { ProjetPhase, projetPhasesEnum, serviceContext } from "@database/schema";
import { InferInsertModel } from "drizzle-orm";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { competenceCodes } from "@/shared/const/competences-list";
import { leviers } from "@/shared/const/leviers";
import { ExtraFieldConfig } from "@/services/dto/extra-fields-config.dto";
import { RegionCode, regionCodes } from "@/shared/const/region-codes";

export class CreateServiceContextResponse {
  @ApiProperty()
  @IsString()
  id!: string;
}

export class CreateServiceContextRequest implements Omit<InferInsertModel<typeof serviceContext>, "serviceId"> {
  @ApiProperty({
    nullable: true,
    type: String,
    isArray: true,
    required: true,
    enum: competenceCodes,
    description: "Array of competences and sous-competences, empty array means all competences/sous-competences",
  })
  @IsArray()
  @ValidateIf((_object: CreateServiceContextRequest, value: CompetenceCodes | null) => value !== null)
  @IsIn(competenceCodes, { each: true })
  competences!: CompetenceCodes | null;

  @ApiProperty({
    type: String,
    enum: leviers,
    isArray: true,
    nullable: true,
    required: true,
    description: "Array of leviers, empty array means all leviers",
    example: ["Bio-carburants", "Covoiturage"],
  })
  @IsArray()
  @ValidateIf((_object: CreateServiceContextRequest, value: Leviers | null) => value !== null)
  @IsIn(leviers, { each: true })
  leviers!: Leviers | null;

  @ApiProperty({
    enum: projetPhasesEnum.enumValues,
    isArray: true,
    nullable: true,
    required: true,
    description: "Project phases for which the serviceContext applies, empty array means all phases",
  })
  @IsArray()
  @ValidateIf((_object: CreateServiceContextRequest, value: ProjetPhase[] | null) => value !== null)
  @IsEnum(projetPhasesEnum.enumValues, { each: true })
  phases!: ProjetPhase[] | null;

  @ApiProperty({
    description: "Array of region codes for which the service context applies, empty array means all regions",
    example: ["11", "24"],
    enum: regionCodes,
    required: true,
    isArray: true,
  })
  @IsArray()
  @IsIn(regionCodes, { each: true })
  regions!: RegionCode[];

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsString()
  @IsOptional()
  sousTitre?: string | null;

  @ApiProperty({
    description: "Custom logo URL for the service in this context",
    example: "https://example.com/custom-logo.png",
    required: false,
    nullable: true,
    type: String,
  })
  @IsUrl()
  @IsOptional()
  logoUrl?: string | null;

  @ApiProperty({
    description: "Custom redirection URL for the service in this context",
    example: "https://service.example.com/specific-page",
    type: String,
    required: false,
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  redirectionUrl?: string | null;

  @ApiProperty({
    description: "Custom label for the redirection button",
    example: "Access Climate Tools",
    type: String,
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  redirectionLabel?: string | null;

  @ApiProperty({
    description: "Custom label for expanding the service details",
    example: "Show climate data",
    type: String,
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  extendLabel?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
  })
  @IsString()
  @IsOptional()
  iframeUrl?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
  })
  @IsString()
  @IsOptional()
  name?: string | null;

  @ApiProperty({
    description: "Array of extra field definitions required for this service context",
    example: [{ name: "field1", label: "Field 1 Label" }],
    type: [ExtraFieldConfig],
    required: false,
    nullable: true,
  })
  @IsArray()
  @IsOptional()
  extraFields?: { name: string; label: string }[] | null;

  @ApiProperty({
    description: "Whether the service context will be associated with projects",
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isListed?: boolean;
}
