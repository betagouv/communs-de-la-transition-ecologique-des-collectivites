import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

// Types d'objets référençables. Les IDs pointés doivent TOUJOURS être des IDs
// objets stables (UUID sources, ids cop_*, dgcl-*…), jamais un cluster_id.
export const OBJET_TYPES = ["projet", "fiche_action", "plan", "financement"] as const;
export type ObjetType = (typeof OBJET_TYPES)[number];

export class CreateDecisionDto {
  @ApiProperty({
    description:
      "Type de décision. Vocabulaire évolutif, non contraint par une enum stricte " +
      "(ex. lien_confirme, lien_infirme, doublon_signale, projet_valide, projet_obsolete, rattachement_pcaet).",
    example: "lien_confirme",
  })
  @IsString()
  @IsNotEmpty()
  typeDecision!: string;

  @ApiProperty({
    description: "Type de l'objet A concerné par la décision.",
    enum: OBJET_TYPES,
  })
  @IsIn(OBJET_TYPES)
  objetAType!: ObjetType;

  @ApiProperty({
    description:
      "ID STABLE de l'objet A (UUID source, id cop_*, dgcl-*…). " +
      "JAMAIS un cluster_id : les identifiants de cluster sont recalculés à chaque run de l'ETL.",
  })
  @IsString()
  @IsNotEmpty()
  objetAId!: string;

  @ApiPropertyOptional({
    description: "Type de l'objet B (décisions binaires, ex. lien entre deux objets).",
    enum: OBJET_TYPES,
  })
  @IsOptional()
  @IsIn(OBJET_TYPES)
  objetBType?: ObjetType;

  @ApiPropertyOptional({
    description: "ID STABLE de l'objet B (mêmes règles que objetAId — jamais un cluster_id).",
  })
  @IsOptional()
  @IsString()
  objetBId?: string;

  @ApiPropertyOptional({ description: "Verdict associé (ex. confirme, infirme, fusionner)." })
  @IsOptional()
  @IsString()
  verdict?: string;

  @ApiPropertyOptional({ description: "Identifiant de l'agent auteur, si transmis par la plateforme." })
  @IsOptional()
  @IsString()
  auteur?: string;

  @ApiPropertyOptional({ description: "Commentaire libre." })
  @IsOptional()
  @IsString()
  commentaire?: string;

  @ApiPropertyOptional({
    type: Object,
    description: "Charge utile structurée additionnelle propre à la décision.",
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class DecisionCreatedResponse {
  @ApiProperty({ description: "ID de la décision créée." })
  id!: string;

  @ApiProperty({ description: "Horodatage de création (ISO 8601)." })
  createdAt!: string;
}

export class DecisionRecordResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  typeDecision!: string;

  @ApiProperty({ enum: OBJET_TYPES })
  objetAType!: string;

  @ApiProperty()
  objetAId!: string;

  @ApiPropertyOptional({ enum: OBJET_TYPES, nullable: true })
  objetBType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  objetBId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  verdict!: string | null;

  @ApiPropertyOptional({ nullable: true })
  auteur!: string | null;

  @ApiProperty({ description: "Plateforme émettrice, dérivée de la clé API authentifiée." })
  plateformeSource!: string;

  @ApiPropertyOptional({ nullable: true })
  commentaire!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  payload!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, description: "ID de la décision qui révoque celle-ci, le cas échéant." })
  supersededBy!: string | null;
}

export class DecisionListResponse {
  @ApiProperty({ type: [DecisionRecordResponse] })
  items!: DecisionRecordResponse[];
}
