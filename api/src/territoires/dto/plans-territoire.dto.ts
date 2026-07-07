import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PcaetReferenceDto {
  @ApiPropertyOptional({ nullable: true, description: "Nom du PCAET." })
  nom!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "SIREN du porteur du PCAET." })
  sirenPorteur!: string | null;

  @ApiProperty({ description: "Le PCAET est-il présent dans TeT (tet_external_id renseigné) ?" })
  presentDansTet!: boolean;

  @ApiPropertyOptional({ nullable: true, description: "External ID TeT du PCAET, si présent dans TeT." })
  tetExternalId?: string | null;

  @ApiPropertyOptional({
    enum: ["live", "snapshot", "opendata"],
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
