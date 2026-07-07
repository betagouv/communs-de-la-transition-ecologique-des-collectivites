import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PcaetReferenceDto {
  @ApiPropertyOptional({ nullable: true, description: "Nom du PCAET." })
  nom!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "SIREN du porteur du PCAET." })
  sirenPorteur!: string | null;

  @ApiProperty({
    description:
      "Le PCAET est-il présent dans le snapshot TeT (tet_external_id renseigné) ? " +
      "Indique la présence dans le snapshot, sans garantir un deep-link exploitable.",
  })
  presentDansTet!: boolean;

  @ApiPropertyOptional({ nullable: true, description: "External ID TeT du PCAET, si présent dans le snapshot TeT." })
  tetExternalId?: string | null;

  @ApiPropertyOptional({
    // Canal 'live' exclu de facto : seuls 'snapshot' et 'opendata' alimentent la référence.
    enum: ["snapshot", "opendata"],
    nullable: true,
    description: "Source de la fiche PCAET de référence (source_nom).",
  })
  source!: string | null;
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
