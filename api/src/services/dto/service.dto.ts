import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { ProjetPhase, projetPhasesEnum, serviceContext, services } from "@database/schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { ExtraFieldConfig } from "@/services/dto/extra-fields-config.dto";
import { CompetenceCode, CompetenceCodes, Levier, Leviers } from "@/shared/types";
import { competenceCodes } from "@/shared/const/competences-list";
import { leviers } from "@/shared/const/leviers";

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

const toArray = <T>(value: any): T[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value as T[];
  return [value] as T[];
};

export class GetServicesByContextQuery {
  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    enum: competenceCodes,
    description: "Array of competences and sous-competences",
    example: ["90-411", "90-311"],
  })
  @Transform(({ value }) => toArray<CompetenceCode>(value))
  @IsArray()
  @IsOptional()
  competences?: CompetenceCodes;

  @ApiProperty({
    type: String,
    isArray: true,
    required: false,
    enum: leviers,
    description: "Array of leviers",
    example: ["Bio-carburants", "Covoiturage"],
  })
  @Transform(({ value }) => toArray<Levier>(value))
  @IsArray()
  @IsOptional()
  leviers?: Leviers;

  @ApiProperty({
    type: String,
    enum: projetPhasesEnum.enumValues,
    isArray: true,
    description: "Project phases",
    example: ["Idée"],
  })
  @Transform(({ value }) => toArray<ProjetPhase>(value))
  @IsArray()
  @IsEnum(projetPhasesEnum.enumValues, { each: true })
  phases!: ProjetPhase[];
}
