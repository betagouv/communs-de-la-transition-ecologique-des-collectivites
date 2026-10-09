import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LabelsMetaDto, ThematiqueIndicateurDto } from "./synthese.dto";

export class CollectiviteIndicateursDto {
  @ApiProperty()
  siren!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ description: "commune, ou type de groupement (CC, CA, CU, METRO, SIVU, SIVOM, SMF, SMO, PETR…)." })
  type!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  population!: number | null;

  @ApiProperty({ description: "Nombre de projets portés par la collectivité, doublons regroupés." })
  nbProjets!: number;

  @ApiProperty()
  nbFinancements!: number;

  @ApiProperty({ description: "Somme des montants attribués (statut Obtenu ou Payé)." })
  montantAttribueTotal!: number;

  @ApiProperty({ type: [ThematiqueIndicateurDto], description: "Cinq premières thématiques par nombre de projets." })
  principalesThematiques!: ThematiqueIndicateurDto[];
}

export class CollectivitesConsultationResponse {
  @ApiProperty({ type: [CollectiviteIndicateursDto] })
  data!: CollectiviteIndicateursDto[];

  @ApiProperty()
  limit!: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "SIREN à repasser dans `cursor` pour la page suivante. Null en fin de liste.",
  })
  nextCursor!: string | null;

  @ApiProperty({ type: LabelsMetaDto })
  labels!: LabelsMetaDto;
}
