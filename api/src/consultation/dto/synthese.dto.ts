import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FinancementsSourceAnneeDto {
  @ApiProperty({ description: "Dispositif ou financeur (ex. DETR, DSIL, Fonds Vert)." })
  source!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "Année d'attribution. Null quand la date d'attribution n'est pas renseignée.",
  })
  annee!: number | null;

  @ApiProperty({ description: "Nombre de financements, tous statuts confondus." })
  nbFinancements!: number;

  @ApiProperty({ description: "Somme des montants attribués (financements au statut Obtenu ou Payé)." })
  montantAttribue!: number;
}

export class CompletudeSourceDto {
  @ApiProperty()
  source!: string;

  @ApiProperty()
  nbFinancements!: number;

  @ApiProperty({ description: "Part (0 à 1) des financements dont le montant attribué est renseigné." })
  tauxMontantRenseigne!: number;

  @ApiProperty({ description: "Part (0 à 1) des financements dont la date d'attribution est renseignée." })
  tauxDateRenseignee!: number;
}

export class ThematiqueIndicateurDto {
  @ApiProperty()
  thematique!: string;

  @ApiProperty()
  nbProjets!: number;

  @ApiProperty({
    description:
      "Montant attribué aux projets portant cette thématique. Un projet à plusieurs thématiques compte dans chacune : " +
      "ces montants ne s'additionnent pas.",
  })
  montantAttribue!: number;
}

export class TauxFinancementDto {
  @ApiProperty({
    description: "Nombre de lignes de projet disposant à la fois d'un budget prévisionnel et d'un montant attribué.",
  })
  nbProjetsComparables!: number;

  @ApiProperty({ description: "Montant attribué sur ces projets." })
  montantAttribue!: number;

  @ApiProperty({ description: "Budget prévisionnel de ces projets." })
  budgetPrevisionnel!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: "montantAttribue / budgetPrevisionnel. Null si aucun projet comparable.",
  })
  taux!: number | null;
}

export class LabelsMetaDto {
  @ApiProperty({ enum: [true] })
  provisoire!: true;

  @ApiProperty()
  methode!: string;
}

export class SyntheseCollectiviteResponse {
  @ApiProperty()
  siren!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Nom de la collectivité, si connue du référentiel.",
  })
  nom!: string | null;

  @ApiProperty({ description: "Nombre de projets, doublons regroupés." })
  nbProjets!: number;

  @ApiProperty({ description: "Nombre de lignes de la base avant regroupement." })
  nbLignes!: number;

  @ApiProperty()
  nbFinancements!: number;

  @ApiProperty({ description: "Somme des montants attribués (statut Obtenu ou Payé)." })
  montantAttribueTotal!: number;

  @ApiProperty({ type: [FinancementsSourceAnneeDto] })
  financementsParSourceEtAnnee!: FinancementsSourceAnneeDto[];

  @ApiProperty({
    type: [CompletudeSourceDto],
    description: "Complétude des montants et des dates par source : à lire avant d'interpréter les totaux.",
  })
  completudeParSource!: CompletudeSourceDto[];

  @ApiProperty({ type: [ThematiqueIndicateurDto], description: "Thématiques issues des labels provisoires." })
  parThematique!: ThematiqueIndicateurDto[];

  @ApiProperty({ type: TauxFinancementDto })
  tauxFinancement!: TauxFinancementDto;

  @ApiProperty({ type: LabelsMetaDto })
  labels!: LabelsMetaDto;

  @ApiProperty({ type: [String], description: "Réserves à porter à la connaissance du lecteur de la fiche." })
  avertissements!: string[];
}
