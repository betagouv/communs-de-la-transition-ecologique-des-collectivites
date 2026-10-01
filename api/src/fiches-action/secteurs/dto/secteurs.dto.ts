import { ApiProperty } from "@nestjs/swagger";
import { SECTEURS, Secteur } from "../secteurs-mapping.const";

export class SecteurBreakdownDto {
  @ApiProperty({
    description:
      "Secteur de PLUS FORTE part (le maximum de `parts`) ; null quand la part non attribuable " +
      "domine toutes les parts. Pour un rattachement simple, prendre ce champ tel quel.",
    enum: SECTEURS,
    nullable: true,
    type: String,
    example: "dechets",
  })
  dominant!: Secteur | null;

  @ApiProperty({
    description: "Part de la fiche non rattachable à un secteur d'émissions (0-1).",
    example: 0.19,
  })
  nonAttribuable!: number;

  @ApiProperty({
    description:
      "Parts par secteur (0-1), les 8 secteurs toujours présents — la somme des parts et de " +
      "nonAttribuable vaut 1. `dominant` est le secteur de part maximale.",
    example: {
      residentiel: 0,
      tertiaire: 0.06,
      transport_routier: 0,
      autres_transports: 0,
      agriculture: 0,
      dechets: 0.75,
      industrie_hors_branche_energie: 0,
      branche_energie: 0,
    },
    type: Object,
  })
  parts!: Record<Secteur, number>;
}

export class SecteursResponse {
  @ApiProperty({ description: "ID interne de la fiche action" })
  id!: string;

  @ApiProperty({
    description:
      "Secteurs réglementaires — sémantique « association directe » (le secteur dont relève le projet). " +
      "Null si la fiche n'a ni classification ni levier exploitables.",
    type: SecteurBreakdownDto,
    nullable: true,
  })
  secteursDirect!: SecteurBreakdownDto | null;

  @ApiProperty({
    description:
      "Secteurs réglementaires — sémantique « contribution » (les secteurs d'émissions sur lesquels le projet agit, " +
      "effets indirects répartis). Null si aucune entrée exploitable.",
    type: SecteurBreakdownDto,
    nullable: true,
  })
  secteursContribution!: SecteurBreakdownDto | null;

  @ApiProperty({
    description: "Version de la méthode (mapping déterministe + agrégation) ayant produit la réponse.",
    example: "mapping-v1.1/agregation-v1",
  })
  methode!: string;
}
