import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TerritoireGroupeDto } from "./territoire-projets.dto";

// En-tête de réponse : le PCAET résolu depuis la clé (SIREN porteur ou plan_id).
// Seul le SIREN porteur est une clé stable (cf. decision-contract) — les plan_id
// bougent d'un run d'ETL à l'autre et ne servent qu'à retrouver la ligne.
export class PcaetEnteteDto {
  @ApiProperty({ description: "SIREN du porteur du PCAET (clé stable, 9 chiffres)." })
  sirenPorteur!: string;

  @ApiPropertyOptional({ nullable: true, description: "Nom du PCAET." })
  nom!: string | null;

  @ApiPropertyOptional({
    // Canal 'live' exclu de facto : seuls 'snapshot' et 'opendata' alimentent la référence.
    enum: ["snapshot", "opendata"],
    nullable: true,
    description: "Source de la fiche PCAET de référence (source_nom).",
  })
  source!: string | null;
}

// Un groupe de la vue territoriale, augmenté de son rattachement AU PCAET interrogé.
export class TerritoireGroupeRattacheDto extends TerritoireGroupeDto {
  @ApiProperty({
    enum: ["confirme", "infirme", "suggere", "aucun"],
    description:
      "État du rattachement du groupe (projet réel) à CE PCAET :\n" +
      "- `confirme` / `infirme` : dérivé de la décision active `rattachement_pcaet` la plus récente " +
      "entre une trace du groupe et ce PCAET (SIREN porteur) ;\n" +
      "- `suggere` : aucune décision humaine, mais au moins une trace du groupe est marquée opération " +
      "PCAET par le pipeline (`pcaet_operation_inscrite`) — signal indicatif, à confirmer côté TeT ;\n" +
      "- `aucun` : ni décision, ni signal.",
  })
  rattachement!: "confirme" | "infirme" | "suggere" | "aucun";
}

export class PlansProjetsTerritoireResponse {
  @ApiProperty({ type: PcaetEnteteDto, description: "PCAET résolu depuis la clé." })
  pcaet!: PcaetEnteteDto;

  @ApiProperty({ description: "Nombre total de groupes du territoire correspondant aux filtres." })
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty({ type: [TerritoireGroupeRattacheDto] })
  groupes!: TerritoireGroupeRattacheDto[];
}
