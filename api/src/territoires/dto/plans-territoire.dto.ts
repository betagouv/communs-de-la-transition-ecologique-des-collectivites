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
      "Le PCAET est-il présent dans le snapshot TeT (tet_external_id renseigné) ? " +
      "Indique la présence dans le snapshot, sans garantir un deep-link exploitable.",
  })
  presentDansTet!: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "External ID TeT du PCAET, si présent dans le snapshot TeT.",
  })
  tetExternalId?: string | null;

  @ApiProperty({
    type: String,
    // Canal 'live' exclu de facto : seuls 'snapshot' et 'opendata' alimentent la référence.
    enum: ["snapshot", "opendata"],
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
