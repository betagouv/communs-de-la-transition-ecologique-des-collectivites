import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";

export class PlanReference {
  @ApiProperty({ description: "ID externe du plan côté source" })
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

export class CreateFicheActionRequest {
  @ApiProperty({ description: "Nom de la fiche action" })
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty({ required: true, description: "ID externe (plateforme source)" })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @ApiPropertyOptional({ type: String, description: "Description" })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: String, description: "Objectifs visés" })
  @IsOptional()
  @IsString()
  objectifs?: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Statut (À venir, En cours, En retard, En pause, Bloqué, Abandonné, Terminé)",
  })
  @IsOptional()
  @IsString()
  statut?: string | null;

  @ApiPropertyOptional({ type: String, description: "ID externe du parent (sous-action → action)" })
  @IsOptional()
  @IsString()
  parentExternalId?: string | null;

  @ApiProperty({ type: [CollectiviteReference], description: "Collectivités concernées (SIREN ou code INSEE)" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectiviteReference)
  @ArrayNotEmpty()
  collectivites!: CollectiviteReference[];

  @ApiPropertyOptional({ type: [PlanReference], description: "Plans de transition liés" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanReference)
  plans?: PlanReference[];

  // Fields from the existing webhook accepted for backward compatibility
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  budgetPrevisionnel?: number | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  dateDebutPrevisionnelle?: string | null;

  @ApiPropertyOptional({ type: String, description: "Phase (accepted for compat, not stored)" })
  @IsOptional()
  @IsString()
  phase?: string | null;

  @ApiPropertyOptional({ type: String, description: "Phase statut (used as fallback for statut)" })
  @IsOptional()
  @IsString()
  phaseStatut?: string | null;

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

  // Porteur accepted for compat but not stored (RGPD - v0.2 recommendation)
  @ApiPropertyOptional({ description: "Porteur (accepted but not stored per RGPD)" })
  @IsOptional()
  porteur?: Record<string, unknown> | null;
}

export class CreateFicheActionResponse {
  @ApiProperty()
  id!: string;
}
