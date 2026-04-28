import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";

export class MecPlanReference {
  @ApiProperty({ description: "ID externe du plan côté MEC" })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @ApiPropertyOptional({ description: "Nom du plan" })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({ description: "Type de plan (PCAET, CRTE, PAT...)" })
  @IsOptional()
  @IsString()
  type?: string;
}

export class CreateMecProjetRequest {
  @ApiProperty({ description: "Nom du projet" })
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty({ required: true, description: "ID externe (MEC)" })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @ApiProperty({ type: [CollectiviteReference], description: "Collectivités concernées (SIREN ou code INSEE)" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectiviteReference)
  @ArrayNotEmpty()
  collectivites!: CollectiviteReference[];

  @ApiPropertyOptional({ type: String, description: "Description du projet" })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: Number, description: "Budget prévisionnel en euros" })
  @IsOptional()
  @IsNumber()
  budgetPrevisionnel?: number | null;

  @ApiPropertyOptional({ type: String, description: "Date de début (ISO)" })
  @IsOptional()
  @IsString()
  dateDebut?: string | null;

  @ApiPropertyOptional({ type: String, description: "Date de fin (ISO)" })
  @IsOptional()
  @IsString()
  dateFin?: string | null;

  @ApiPropertyOptional({ type: String, description: "Phase (Idée, Étude, Opération)" })
  @IsOptional()
  @IsString()
  phase?: string | null;

  @ApiPropertyOptional({ type: String, description: "Statut de la phase" })
  @IsOptional()
  @IsString()
  phaseStatut?: string | null;

  @ApiPropertyOptional({ type: String, description: "SIRET du porteur opérationnel" })
  @IsOptional()
  @IsString()
  porteurSiret?: string | null;

  @ApiPropertyOptional({ type: [String], description: "Compétences M57" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competences?: string[] | null;

  @ApiPropertyOptional({ type: [String], description: "Leviers SGPE" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leviers?: string[] | null;

  @ApiPropertyOptional({ type: [String], description: "Programmes de rattachement" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  programmes?: string[] | null;

  @ApiPropertyOptional({ type: [String], description: "Codes INSEE des communes du territoire" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  territoireCommunes?: string[] | null;

  @ApiPropertyOptional({ type: [String], description: "Classification thématiques v0.2" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationThematiques?: string[] | null;

  @ApiPropertyOptional({ type: [String], description: "Classification sites v0.2" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationSites?: string[] | null;

  @ApiPropertyOptional({ type: [String], description: "Classification interventions v0.2" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationInterventions?: string[] | null;

  @ApiPropertyOptional({ type: String, description: "ID du CRTE" })
  @IsOptional()
  @IsString()
  crteId?: string | null;

  @ApiPropertyOptional({ type: Number, description: "Année d'inscription au CRTE" })
  @IsOptional()
  @IsNumber()
  crteAnneeInscription?: number | null;

  @ApiPropertyOptional({ type: String, description: "Orientation stratégique CRTE" })
  @IsOptional()
  @IsString()
  crteOrientationStrategique?: string | null;

  @ApiPropertyOptional({ type: String, description: "Source MEC (crte, pcaet, fnv...)" })
  @IsOptional()
  @IsString()
  sourceMec?: string | null;

  @ApiPropertyOptional({ type: Boolean, description: "Opération inscrite au PCAET" })
  @IsOptional()
  @IsBoolean()
  pcaetOperationInscrite?: boolean | null;

  @ApiPropertyOptional({ type: String, description: "Thématiques Fonds Vert" })
  @IsOptional()
  @IsString()
  fnvThematiques?: string | null;

  @ApiPropertyOptional({ type: String, description: "Mots clés" })
  @IsOptional()
  @IsString()
  motsCles?: string | null;

  @ApiPropertyOptional({ type: String, description: "Besoins identifiés" })
  @IsOptional()
  @IsString()
  besoins?: string | null;

  @ApiPropertyOptional({ type: String, description: "Plan de rattachement" })
  @IsOptional()
  @IsString()
  planRattachement?: string | null;

  @ApiPropertyOptional({ type: [MecPlanReference], description: "Plans de transition liés" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MecPlanReference)
  plans?: MecPlanReference[];
}

export class BulkCreateMecProjetsRequest {
  @ApiProperty({ type: [CreateMecProjetRequest], description: "Liste de projets à créer en masse" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMecProjetRequest)
  @ArrayNotEmpty()
  projets!: CreateMecProjetRequest[];
}

export class UpdateMecProjetRequest {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  nom?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  budgetPrevisionnel?: number | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  dateDebut?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  dateFin?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  phase?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  phaseStatut?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  porteurSiret?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competences?: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leviers?: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  programmes?: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  territoireCommunes?: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationThematiques?: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationSites?: string[] | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationInterventions?: string[] | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  crteId?: string | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  crteAnneeInscription?: number | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  crteOrientationStrategique?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  sourceMec?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  pcaetOperationInscrite?: boolean | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  fnvThematiques?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  motsCles?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  besoins?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  planRattachement?: string | null;
}

export class CreateMecProjetResponse {
  @ApiProperty()
  id!: string;
}

export class BulkCreateMecProjetsResponse {
  @ApiProperty({ type: [String] })
  ids!: string[];
}
