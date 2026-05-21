import { ApiProperty } from "@nestjs/swagger";

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

  @ApiProperty({
    required: false,
    type: Number,
    description: "Score du matching thématique (labels de classification)",
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
    description: "Score du matching lexical (BM25 texte projet ↔ texte aide), 0-1",
  })
  textualScore?: number;

  @ApiProperty({
    required: false,
    type: Number,
    description: "Score combiné thématique + textuel — c'est le critère de tri",
  })
  combinedScore?: number;

  @ApiProperty({ required: false, type: [String], description: "Termes du projet retrouvés dans le texte de l'aide" })
  matchedTerms?: string[];
}

export type AidesListStatus = "ok" | "no_match" | "no_aides_on_perimeter";

export class AidesListResponse {
  @ApiProperty({
    enum: ["ok", "no_match", "no_aides_on_perimeter"],
    description:
      "Statut du résultat — `ok` : aides matchées triées par pertinence ; `no_match` : aides présentes sur le périmètre mais aucune ne partage de label de classification ≥ 0.8 avec le projet ; `no_aides_on_perimeter` : aucune aide AT n'a été trouvée pour les codes INSEE du projet.",
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
