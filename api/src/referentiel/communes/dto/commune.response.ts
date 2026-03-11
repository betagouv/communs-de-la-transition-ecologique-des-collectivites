import { ApiProperty } from "@nestjs/swagger";

export class CompetenceSummary {
  @ApiProperty({ example: "1505" })
  code!: string;

  @ApiProperty({ example: "Eau (production, traitement, stockage, transport, distribution)" })
  nom!: string;
}

export class GroupementSummary {
  @ApiProperty({ example: "200065928" })
  siren!: string;

  @ApiProperty({ example: "Lannion-Trégor Communauté" })
  nom!: string;

  @ApiProperty({ example: "CA" })
  type!: string;
}

export class GroupementSummaryWithCompetences extends GroupementSummary {
  @ApiProperty({ type: [CompetenceSummary], description: "Compétences exercées par ce groupement" })
  competences!: CompetenceSummary[];
}

export class CommuneResponse {
  @ApiProperty({ description: "Code INSEE (5 chiffres)", example: "22006" })
  code!: string;

  @ApiProperty({ example: "Bégard" })
  nom!: string;

  @ApiProperty({ description: "SIREN (9 chiffres)", example: "212200067" })
  siren!: string;

  @ApiProperty({ description: "SIREN de l'EPCI de rattachement", example: "200065928", nullable: true })
  codeEpci!: string | null;

  @ApiProperty({ example: "22" })
  codeDepartement!: string;

  @ApiProperty({ example: "53" })
  codeRegion!: string;

  @ApiProperty({ example: 4832, nullable: true })
  population!: number | null;

  @ApiProperty({ example: ["22140"], nullable: true })
  codesPostaux!: string[] | null;
}

export class CommuneDetailResponse extends CommuneResponse {
  @ApiProperty({
    type: [GroupementSummaryWithCompetences],
    description: "Groupements dont cette commune est membre (avec compétences si includeCompetences=true)",
  })
  groupements!: (GroupementSummary | GroupementSummaryWithCompetences)[];
}
