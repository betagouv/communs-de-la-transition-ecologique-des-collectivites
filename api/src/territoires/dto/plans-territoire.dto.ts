import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PcaetReferenceDto {
  // nom / sirenPorteur / source sont TOUJOURS présents dans la réponse (éventuellement null),
  // donc @ApiProperty (requis) + type explicite : sans `type`, openapi-typescript génère
  // `Record<string, never> | null` au lieu de `string | null`, et @ApiPropertyOptional les
  // rendait optionnels côté client à tort (signalé par Sylvain / MEC).
  @ApiProperty({ type: String, nullable: true, description: "Nom du PCAET." })
  nom!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "SIREN du porteur du PCAET." })
  sirenPorteur!: string | null;

  @ApiProperty({
    description:
      "Le PCAET a-t-il un identifiant de plan TeT (tetExternalId) exploitable pour le deep-link ? " +
      "Vrai quand le plan provient du canal live ou snapshot TeT.",
  })
  presentDansTet!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Identifiant du plan côté TeT (= planId du deep-link /collectivite/:collectiviteId/plans/:planId).",
  })
  tetExternalId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Identifiant interne de la collectivité porteuse côté TeT (= collectiviteId du deep-link " +
      "/collectivite/:collectiviteId/plans/:planId). Null si le PCAET ne vient que de l'opendata.",
  })
  collectiviteId?: string | null;

  @ApiProperty({
    type: String,
    // Canal du plan représentatif retenu (dédup par SIREN, priorité live > snapshot > opendata).
    enum: ["live", "snapshot", "opendata"],
    nullable: true,
    description: "Source de la fiche PCAET de référence (source_nom).",
  })
  source!: string | null;

  @ApiProperty({
    enum: ["confirme", "infirme", "aucun"],
    description:
      "État du rattachement projet ↔ PCAET, dérivé de la décision active rattachement_pcaet la plus récente " +
      "entre ce projet et ce PCAET (SIREN porteur). 'aucun' si aucune décision active.",
  })
  rattachement!: "confirme" | "infirme" | "aucun";
}

export class PlansTerritoireResponse {
  @ApiProperty({ type: [PcaetReferenceDto], description: "PCAET couvrant les communes du projet." })
  pcaet!: PcaetReferenceDto[];

  @ApiProperty({
    type: [Object],
    description: "Fiches action suggérées (bonus hors scope immédiat — tableau vide pour l'instant).",
  })
  fichesActionSuggerees!: unknown[];
}
