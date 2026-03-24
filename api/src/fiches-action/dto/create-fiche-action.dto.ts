import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CollectiviteReference } from "@projets/dto/collectivite.dto";
import { PorteurDto } from "@projets/dto/porteur.dto";

export class PlanReference {
  @ApiProperty({ description: "ID du plan côté TeT" })
  @IsString()
  @IsNotEmpty()
  id!: string;

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

  @ApiProperty({ required: true, description: "ID externe TeT" })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  @ApiPropertyOptional({ type: String, description: "Description de la fiche action" })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ type: String, description: "ID externe du parent (sous-action → action)" })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsNumber()
  budgetPrevisionnel?: number | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  dateDebutPrevisionnelle?: string | null;

  @ApiPropertyOptional({ type: String, description: "Statut de la fiche action" })
  @IsOptional()
  @IsString()
  statut?: string | null;

  @ApiProperty({ type: [CollectiviteReference], description: "Collectivités concernées" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectiviteReference)
  @ArrayNotEmpty()
  collectivites!: CollectiviteReference[];

  @ApiPropertyOptional({ type: PorteurDto })
  @ValidateNested()
  @Type(() => PorteurDto)
  @IsOptional()
  porteur?: PorteurDto | null;

  @ApiPropertyOptional({ type: [PlanReference], description: "Plans de transition liés" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanReference)
  plans?: PlanReference[];

  // Fields from the existing webhook that we accept but don't use for fiches
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  phase?: string | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  phaseStatut?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  competences?: string[] | null;
}

export class CreateFicheActionResponse {
  @ApiProperty()
  id!: string;
}
