import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SourceReferenceDto {
  @ApiProperty({ description: "Source de données d'origine (ex. dgcl, fonds-vert, decp, agences-eau)." })
  source!: string;

  @ApiProperty({
    description:
      "Identifiant de la ligne dans cette source. Avec `source`, c'est la clé de suivi à conserver d'un snapshot à l'autre.",
  })
  idSource!: string;

  @ApiProperty({
    description: "Rôle de la ligne source dans le projet consolidé (inchange, fusionne, marche_absorbe).",
  })
  role!: string;
}

export class FinancementConsultationDto {
  @ApiProperty({ description: "Dispositif ou financeur (ex. DETR, DSIL, Fonds Vert, Agence de l'eau)." })
  source!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: "Référence du dossier chez le financeur." })
  referenceExterne!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "date" })
  dateAttribution!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  montantDemande!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  montantAttribue!: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Obtenu, Payé, Demandé, Prévisionnel ou Refusé.",
  })
  statut!: string | null;
}

export class ProbabiliteTeDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  global!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  attenuation!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  adaptation!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  biodiversite!: number | null;
}

const COTATION = "favorable, neutre, défavorable ou non coté";

export class BudgetVertDto {
  @ApiPropertyOptional({ type: String, nullable: true, description: COTATION })
  attenuation!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: COTATION })
  adaptation!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: COTATION })
  eau!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: COTATION })
  circulaire!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: COTATION })
  pollution!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: COTATION })
  biodiversite!: string | null;
}

export class LabelsConsultationDto {
  @ApiProperty({
    enum: [true],
    description:
      "Toujours vrai : labels issus d'une classification automatique au seuil de 0,5, non calibré. Les valeurs peuvent changer.",
  })
  provisoire!: true;

  @ApiProperty({ description: "Version de la méthode de classification." })
  methode!: string;

  @ApiProperty({ type: [String], description: "Thématiques, de la plus forte à la plus faible." })
  classificationThematiques!: string[];

  @ApiProperty({ type: [String] })
  classificationSites!: string[];

  @ApiProperty({ type: [String] })
  classificationInterventions!: string[];

  @ApiProperty({ type: [String], description: "Leviers SGPE." })
  leviersSgpe!: string[];

  @ApiProperty({
    type: [String],
    description: "Codes de compétences M57. Nombreux par projet à ce seuil : à ne pas agréger.",
  })
  competencesM57!: string[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Nature dominante. Indicative : ne pas s'en servir pour exclure des projets.",
  })
  nature!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  natureConfiance!: number | null;

  @ApiProperty({
    type: ProbabiliteTeDto,
    description: "Probabilités (0 à 1) de contribution à la transition écologique.",
  })
  probabiliteTe!: ProbabiliteTeDto;

  @ApiProperty({ type: BudgetVertDto, description: "Cotation budget vert par axe." })
  budgetVert!: BudgetVertDto;
}

export class ProjetConsultationDto {
  @ApiProperty({
    type: [SourceReferenceDto],
    description:
      "Référence du projet : ses clés dans les sources d'origine. Aucun identifiant interne n'est exposé " +
      "(il change à chaque reconstruction de la base).",
  })
  sources!: SourceReferenceDto[];

  @ApiProperty({
    description:
      "Nombre de lignes de la base regroupées dans ce projet (même collectivité, même intitulé). 1 = pas de doublon.",
  })
  nbLignesRegroupees!: number;

  @ApiProperty()
  nom!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  budgetPrevisionnel!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "date" })
  dateDebut!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: "date" })
  dateFin!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phase!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phaseStatut!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  collectiviteResponsableSiren!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  porteurOperationnelSiret!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  porteurNom!: string | null;

  @ApiProperty({ type: [String], description: "Codes INSEE des communes concernées." })
  territoireCommunes!: string[];

  @ApiProperty({ type: [String], description: "Codes des départements concernés." })
  territoireDepartements!: string[];

  @ApiPropertyOptional({ type: Number, nullable: true })
  localisationLatitude!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  localisationLongitude!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  localisationAdresse!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  localisationBanId!: string | null;

  @ApiProperty({ type: [String] })
  planTransitionIds!: string[];

  @ApiProperty({ type: [String] })
  programmesRattachement!: string[];

  @ApiProperty({
    enum: ["ouvert", "public_sans_licence", "interne"],
    description: "Régime d'ouverture de la donnée d'origine.",
  })
  ouverture!: string;

  @ApiPropertyOptional({
    type: LabelsConsultationDto,
    nullable: true,
    description: "Null pour les rares projets sans intitulé exploitable.",
  })
  labels!: LabelsConsultationDto | null;

  @ApiProperty({
    type: [FinancementConsultationDto],
    description: "Financements de toutes les lignes regroupées dans ce projet.",
  })
  financements!: FinancementConsultationDto[];
}

export class ProjetsConsultationResponse {
  @ApiProperty({ type: [ProjetConsultationDto] })
  data!: ProjetConsultationDto[];

  @ApiProperty()
  limit!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Curseur de la page suivante, à repasser tel quel dans `cursor`. Null en fin de parcours. " +
      "Valable le temps d'un parcours : un parcours entamé avant une reconstruction de la base est à reprendre du début.",
  })
  nextCursor!: string | null;
}

export class ProjetsCollectiviteResponse extends ProjetsConsultationResponse {
  @ApiProperty({ description: "Nombre total de projets (après regroupement des doublons) correspondant aux filtres." })
  total!: number;
}
