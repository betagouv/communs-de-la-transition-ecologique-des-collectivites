import { ApiProperty } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsEnum, IsIn, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { ProjetPhase, projetPhasesEnum, serviceContext, services } from "@database/schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { ExtraFieldConfig } from "@/services/dto/extra-fields-config.dto";
import { CompetenceCode, CompetenceCodes, Levier, Leviers } from "@/shared/types";
import { competenceCodes } from "@/shared/const/competences-list";
import { leviers } from "@/shared/const/leviers";
import { RegionCode, regionCodes } from "@/shared/const/region-codes";

type ServiceBaseFields = Pick<
  InferSelectModel<typeof services>,
  "id" | "name" | "description" | "sousTitre" | "redirectionUrl" | "logoUrl"
>;
type ServiceContextFields = Pick<InferInsertModel<typeof serviceContext>, "extraFields">;

export class ServicesByProjectIdResponse implements ServiceBaseFields, ServiceContextFields {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  sousTitre!: string;

  @ApiProperty()
  redirectionUrl!: string;

  @ApiProperty()
  logoUrl!: string;

  @ApiProperty({
    type: [ExtraFieldConfig],
    description: "Array of extra field definitions with name and label",
    example: [{ name: "surface", label: "Surface (m²)" }],
  })
  @IsArray()
  extraFields!: ExtraFieldConfig[];

  @ApiProperty({ type: Boolean })
  isListed!: boolean;

  @ApiProperty({ nullable: true, type: String })
  redirectionLabel?: string | null;

  @ApiProperty({ nullable: true, type: String })
  iframeUrl?: string | null;

  @ApiProperty({ nullable: true, type: String })
  extendLabel?: string | null;
}

const formatValue = <T>(value: any, allValues: any): T[] | undefined => {
  if (value === "all") return allValues as T[];
  if (!value) return undefined;
  if (Array.isArray(value)) return value as T[];
  return [value] as T[];
};

export class GetServicesByContextQuery {
  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    enum: [...competenceCodes, "all"],
    description: "Array of competences and sous-competences",
    example: ["90-411", "90-311"],
  })
  @Transform(({ value }) => formatValue<CompetenceCode>(value, competenceCodes))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn([...competenceCodes, "all"], { each: true })
  @IsOptional()
  competences?: CompetenceCodes;

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    enum: [...leviers, "all"],
    description: "Array of leviers",
    example: ["Bio-carburants", "Covoiturage"],
  })
  @Transform(({ value }) => formatValue<Levier>(value, leviers))
  @IsArray()
  @ArrayNotEmpty()
  @IsIn([...leviers, "all"], { each: true })
  @IsOptional()
  leviers?: Leviers;

  @ApiProperty({
    type: String,
    enum: projetPhasesEnum.enumValues,
    isArray: true,
    description: "Project phases",
    example: ["Idée"],
  })
  @Transform(({ value }) => formatValue<ProjetPhase>(value, projetPhasesEnum.enumValues))
  @IsArray()
  @IsEnum(projetPhasesEnum.enumValues, { each: true })
  phases!: ProjetPhase[];

  @ApiProperty({
    type: String,
    isArray: true,
    required: true,
    enum: [...regionCodes, "all"],
    description: "Array of region codes",
    example: ["11"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) => formatValue<RegionCode>(value, regionCodes))
  @IsIn([...regionCodes, "all"], { each: true })
  regions!: RegionCode[];
}
