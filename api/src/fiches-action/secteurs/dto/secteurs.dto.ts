import { ApiProperty } from "@nestjs/swagger";
import { SECTEURS, Secteur } from "../secteurs-mapping.const";

export class SecteurBreakdownDto {
  @ApiProperty({
    description: "Secteur de masse maximale ; null quand la part non attribuable domine.",
    enum: SECTEURS,
    nullable: true,
    type: String,
  })
  dominant!: Secteur | null;

  @ApiProperty({
    description: "Part de la fiche non rattachable à un secteur d'émissions (0-1).",
    example: 0.13,
  })
  nonAttribuable!: number;

  @ApiProperty({
    description: "Parts par secteur (0-1) — la somme des parts et de nonAttribuable vaut 1.",
    example: { residentiel: 0.06, tertiaire: 0.04, dechets: 0.77 },
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
    example: "mapping-jean-v1/agregation-v1",
  })
  methode!: string;
}
