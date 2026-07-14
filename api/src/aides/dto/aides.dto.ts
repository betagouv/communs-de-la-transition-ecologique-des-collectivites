import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AjoutManuelResponse } from "@/ajouts-manuels/dto/ajout-manuel.dto";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class AideFinancerFull {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true, type: String })
  logo!: string | null;
}

export class AideTypeGroup {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;
}

export class AideTypeFull {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: AideTypeGroup })
  group!: AideTypeGroup;
}

export class Aide {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  name_initial!: string;

  @ApiProperty({ nullable: true, type: String })
  short_title!: string | null;

  @ApiProperty({ type: [String] })
  financers!: string[];

  @ApiProperty({ type: [AideFinancerFull] })
  financers_full!: AideFinancerFull[];

  @ApiProperty({ type: [String] })
  instructors!: string[];

  @ApiProperty({ type: [String] })
  programs!: string[];

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ nullable: true, type: String })
  eligibility!: string | null;

  @ApiProperty()
  perimeter!: string;

  @ApiProperty()
  perimeter_id!: number;

  @ApiProperty()
  perimeter_scale!: string;

  @ApiProperty({ type: [String] })
  categories!: string[];

  @ApiProperty({ type: [String] })
  targeted_audiences!: string[];

  @ApiProperty({ type: [String] })
  aid_types!: string[];

  @ApiProperty({ type: [AideTypeFull] })
  aid_types_full!: AideTypeFull[];

  @ApiProperty({ type: [String] })
  mobilization_steps!: string[];

  @ApiProperty({ nullable: true, type: String })
  origin_url!: string | null;

  @ApiProperty({ nullable: true, type: String })
  application_url!: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  is_call_for_project!: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  start_date!: string | null;

  @ApiProperty({ nullable: true, type: String })
  submission_deadline!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  subvention_rate_lower_bound!: number | null;

  @ApiProperty({ nullable: true, type: Number })
  subvention_rate_upper_bound!: number | null;

  @ApiProperty({ nullable: true, type: String })
  subvention_comment!: string | null;

  @ApiProperty({ nullable: true, type: String })
  contact!: string | null;

  @ApiProperty({ nullable: true, type: String })
  recurrence!: string | null;

  @ApiProperty({ nullable: true, type: String })
  project_examples!: string | null;

  @ApiProperty({ nullable: true, type: String })
  date_created!: string | null;

  @ApiProperty({ nullable: true, type: String })
  date_updated!: string | null;
}

export class AideClassificationScore {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  score!: number;
}

export class AideClassification {
  @ApiProperty({ type: [AideClassificationScore] })
  thematiques!: AideClassificationScore[];

  @ApiProperty({ type: [AideClassificationScore] })
  sites!: AideClassificationScore[];

  @ApiProperty({ type: [AideClassificationScore] })
  interventions!: AideClassificationScore[];
}

export class AideLabelsCommuns {
  @ApiProperty({ type: [String] })
  thematiques!: string[];

  @ApiProperty({ type: [String] })
  sites!: string[];

  @ApiProperty({ type: [String] })
  interventions!: string[];
}

export class AideMatchResult {
  @ApiProperty()
  idAt!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  normalizedScore!: number;

  @ApiProperty()
  scoreThematiques!: number;

  @ApiProperty()
  scoreSites!: number;

  @ApiProperty()
  scoreInterventions!: number;

  @ApiProperty()
  axesMatched!: number;

  @ApiProperty({ type: AideLabelsCommuns })
  labelsCommuns!: AideLabelsCommuns;
}

export class AideWithClassification extends Aide {
  @ApiProperty({ required: false, type: AideClassification })
  classification?: AideClassification;

  @ApiPropertyOptional({
    type: AjoutManuelResponse,
    description:
      "Présent si cette aide a été ajoutée À LA MAIN sur ce projet, et non retenue par le moteur. " +
      "Porte le message de la personne qui l'a ajoutée (« recommandée par la DDT lors du COPIL »). " +
      "Ces aides remontent en tête et échappent au cutoff : quelqu'un les a délibérément mises là.",
  })
  ajoutManuel?: AjoutManuelResponse;

  @ApiProperty({
    required: false,
    type: Number,
    description: "Score de pertinence thématique de l'aide pour le projet",
  })
  matchingScore?: number;

  @ApiProperty({ required: false, type: Number })
  normalizedScore?: number;

  @ApiProperty({ required: false, type: Number })
  axesMatched?: number;

  @ApiProperty({ required: false, type: AideLabelsCommuns })
  labelsCommuns?: AideLabelsCommuns;

  @ApiProperty({
    required: false,
    type: Number,
    description: "Score de pertinence textuelle (0-1). Présent si la recherche textuelle complémentaire est activée.",
  })
  textualScore?: number;

  @ApiProperty({
    required: false,
    type: Number,
    description: "Score de pertinence global de l'aide — critère de tri des résultats",
  })
  combinedScore?: number;

  @ApiProperty({
    required: false,
    type: [String],
    description: "Termes du projet retrouvés dans le contenu de l'aide",
  })
  matchedTerms?: string[];
}

export type AidesListStatus = "ok" | "no_match" | "no_aides_on_perimeter";

export class AidesListResponse {
  @ApiProperty({
    enum: ["ok", "no_match", "no_aides_on_perimeter"],
    description:
      "Statut du résultat — `ok` : aides pertinentes trouvées, triées par pertinence ; `no_match` : des aides existent sur le périmètre mais aucune n'est jugée pertinente pour le projet ; `no_aides_on_perimeter` : aucune aide n'a été trouvée sur le territoire du projet.",
  })
  status!: AidesListStatus;

  @ApiProperty({ type: [AideWithClassification] })
  aides!: AideWithClassification[];

  @ApiProperty({ description: "Nombre total d'aides AT trouvées sur le périmètre (avant filtrage matching)" })
  total!: number;
}

export class ClassificationPendingResponse {
  @ApiProperty({ enum: ["classification_pending"] })
  status!: "classification_pending";

  @ApiProperty({ description: "ID du projet en cours de classification" })
  projetId!: string;

  @ApiProperty({ description: "Délai recommandé (en secondes) avant de réessayer la requête" })
  retryAfter!: number;

  @ApiProperty({
    description:
      "Indique si un job de classification a été (re)déclenché par cette requête. `false` signifie qu'un job était déjà en cours.",
  })
  classificationTriggered!: boolean;
}

export class AidesSyncResponse {
  @ApiProperty()
  classified!: number;

  @ApiProperty()
  cached!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  warmupStarted!: boolean;
}

/**
 * Un label de classification fourni en entrée de la recherche d'aides
 * (POST /aides/recherche), avec son niveau de confiance (0-1). Provient
 * typiquement de POST /qualification/classification sur un texte libre.
 */
export class AidesSearchLabel {
  @ApiProperty({ description: "Libellé du label", example: "Rénovation énergétique" })
  @IsString()
  label!: string;

  @ApiProperty({ description: "Niveau de confiance du label (0-1)", example: 0.85 })
  @IsNumber()
  @Min(0)
  @Max(1)
  score!: number;
}

/**
 * Recherche d'aides à partir d'une classification (thématiques / sites /
 * interventions) et d'un périmètre de communes — sans projet de référence.
 * Le matching et le tri par pertinence reprennent la même logique que GET /aides
 * (même périmètre par code INSEE de commune, donc même cache).
 */
export class AidesSearchRequest {
  @ApiPropertyOptional({ type: [AidesSearchLabel], description: "Thématiques recherchées (label + score)" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AidesSearchLabel)
  thematiques?: AidesSearchLabel[];

  @ApiPropertyOptional({ type: [AidesSearchLabel], description: "Sites / lieux recherchés (label + score)" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AidesSearchLabel)
  sites?: AidesSearchLabel[];

  @ApiPropertyOptional({
    type: [AidesSearchLabel],
    description: "Interventions / modalités recherchées (label + score)",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AidesSearchLabel)
  interventions?: AidesSearchLabel[];

  @ApiProperty({
    type: [String],
    description: "Codes INSEE des communes à couvrir (périmètre Aides-Territoires). Au moins une.",
    example: ["44109"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  communes!: string[];

  @ApiPropertyOptional({ description: "Nombre max de résultats (défaut: 20)", example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: "Active une recherche de pertinence textuelle complémentaire (nécessite `query`).",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  textual?: boolean;

  @ApiPropertyOptional({
    description: "Texte libre support du matching textuel complémentaire (utilisé si `textual` est activé).",
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: "Score de pertinence minimal (0-1) sous lequel une aide est écartée. Défaut : aucun seuil.",
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  cutoff?: number;

  @ApiPropertyOptional({
    description: "Seuil de confiance (0-1) des labels d'une aide pris en compte. Défaut : 0.8.",
    example: 0.8,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aideThreshold?: number;

  @ApiPropertyOptional({
    description:
      "Seuil de confiance (0-1) des labels recherchés pris en compte. Défaut bas conseillé pour le texte libre (ex. 0.3).",
    example: 0.3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  projetThreshold?: number;
}
