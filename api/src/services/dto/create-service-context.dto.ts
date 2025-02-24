import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, IsUrl } from "class-validator";
import { ProjectStatus, projectStatusEnum, serviceContext } from "@database/schema";
import { InferInsertModel } from "drizzle-orm";
import { Competences, Leviers } from "@/shared/types";
import { competences } from "@/shared/const/competences-list";
import { leviers } from "@/shared/const/leviers";
import { ExtraFieldConfig } from "@/services/dto/extra-fields-config.dto";

export class CreateServiceContextResponse {
  @ApiProperty()
  @IsString()
  id!: string;
}

export class CreateServiceContextRequest implements Omit<InferInsertModel<typeof serviceContext>, "serviceId"> {
  @ApiProperty({
    type: String,
    enum: competences,
    isArray: true,
    required: true,
    description: "Array of competences and sous-competences, empty array means all competences/sous-competences",
    example: ["Santé", "Culture > Arts plastiques et photographie"],
  })
  @IsArray()
  @IsIn(competences, { each: true })
  competences!: Competences;

  @ApiProperty({
    type: String,
    enum: leviers,
    isArray: true,
    required: false,
    description: "Array of leviers, empty array means all leviers",
    example: ["Bio-carburants", "Covoiturage"],
  })
  @IsArray()
  @IsIn(leviers, { each: true })
  leviers!: Leviers;

  @ApiProperty({ required: false, nullable: true })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsString()
  @IsOptional()
  sousTitre?: string | null;

  @ApiProperty({
    description: "Custom logo URL for the service in this context",
    example: "https://example.com/custom-logo.png",
    required: false,
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  logoUrl?: string | null;

  @ApiProperty({
    description: "Custom redirection URL for the service in this context",
    example: "https://service.example.com/specific-page",
    required: false,
    nullable: true,
  })
  @IsUrl()
  @IsOptional()
  redirectionUrl?: string | null;

  @ApiProperty({
    description: "Custom label for the redirection button",
    example: "Access Climate Tools",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  redirectionLabel?: string | null;

  @ApiProperty({
    description: "Custom label for expanding the service details",
    example: "Show climate data",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  extendLabel?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  iframeUrl?: string | null;

  @ApiProperty({
    enum: projectStatusEnum.enumValues,
    isArray: true,
    required: true,
    description: "Project status for which the serviceContext applies, empty array means all statuses",
  })
  @IsArray()
  status!: ProjectStatus[];

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
}
