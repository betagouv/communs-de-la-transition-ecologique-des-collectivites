import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

// Types d'objets référençables. Les IDs pointés doivent TOUJOURS être des IDs
// objets stables (UUID sources, ids cop_*, dgcl-*…), jamais un cluster_id.
export const OBJET_TYPES = ["projet", "fiche_action", "plan", "financement"] as const;
export type ObjetType = (typeof OBJET_TYPES)[number];

// Taille maximale du payload jsonb (protège la base et les logs d'un abus).
export const PAYLOAD_MAX_BYTES = 10_240;

// Valide qu'une valeur sérialisée en JSON ne dépasse pas `maxBytes` octets (UTF-8).
function MaxJsonBytes(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "maxJsonBytes",
      target: object.constructor,
      propertyName,
      constraints: [maxBytes],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value == null) return true;
          const [limit] = args.constraints as [number];
          return Buffer.byteLength(JSON.stringify(value), "utf8") <= limit;
        },
        defaultMessage(args: ValidationArguments) {
          const [limit] = args.constraints as [number];
          return `payload dépasse la taille maximale de ${limit} octets`;
        },
      },
    });
  };
}

export class CreateDecisionDto {
  @ApiProperty({
    description:
      "Type de décision. Vocabulaire évolutif, non contraint par une enum stricte " +
      "(ex. lien_confirme, lien_infirme, doublon_signale, projet_valide, projet_obsolete, rattachement_pcaet).",
    example: "lien_confirme",
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
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
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  objetBId?: string;

  @ApiPropertyOptional({ description: "Verdict associé (ex. confirme, infirme, fusionner).", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  verdict?: string;

  @ApiPropertyOptional({ description: "Identifiant de l'agent auteur, si transmis par la plateforme.", maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  auteur?: string;

  @ApiPropertyOptional({ description: "Commentaire libre.", maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  commentaire?: string;

  @ApiPropertyOptional({
    description:
      "ID de la décision que celle-ci révoque (chaîne de révocation append-only : " +
      "le nouvel événement pointe vers l'ancien, aucune ligne n'est mutée).",
  })
  @IsOptional()
  @IsUUID()
  supersedes?: string;

  @ApiPropertyOptional({
    type: Object,
    description: `Charge utile structurée additionnelle propre à la décision (max ${PAYLOAD_MAX_BYTES} octets sérialisés).`,
  })
  @IsOptional()
  @IsObject()
  @MaxJsonBytes(PAYLOAD_MAX_BYTES)
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

  @ApiPropertyOptional({ nullable: true, description: "ID de la décision que celle-ci révoque, le cas échéant." })
  supersedes!: string | null;
}

export class DecisionListResponse {
  @ApiProperty({ type: [DecisionRecordResponse] })
  items!: DecisionRecordResponse[];
}
