import { ApiProperty } from "@nestjs/swagger";

export class DispositifResponse {
  @ApiProperty({ description: "SIREN de l'EPCI", example: "248400053" })
  epciSiren!: string;

  @ApiProperty({ description: "Nom de l'EPCI", example: "CA Ventoux-Comtat-Venaissin" })
  epciNom!: string;

  @ApiProperty({ description: "Type de dispositif", example: "COT" })
  dispositif!: string;

  @ApiProperty({ description: "Date de signature", example: "2020-11-12", nullable: true })
  dateSignature!: string | null;

  @ApiProperty({ description: "Statut du dispositif", example: "Suivi du projet" })
  statut!: string;

  @ApiProperty({ description: "Code CRTE rattaché", example: "crte-93-84-13", nullable: true })
  crteCode!: string | null;

  @ApiProperty({ description: "Nom du CRTE", example: "CRTE Ventoux-Comtat-Venaissin", nullable: true })
  crteNom!: string | null;

  @ApiProperty({ description: "Région", example: "Provence-Alpes-Côte d'Azur", nullable: true })
  region!: string | null;
}

export class DispositifStatsResponse {
  @ApiProperty({ description: "Nombre total d'EPCI" })
  totalEpci!: number;

  @ApiProperty({ description: "Nombre de projets MEC dans ces EPCI" })
  nbProjetsMec!: number;

  @ApiProperty({ description: "Nombre de projets toutes sources" })
  nbProjetsToutesSources!: number;

  @ApiProperty({ description: "Répartition par statut" })
  parStatut!: Record<string, number>;
}

export class DispositifsDataResponse {
  @ApiProperty({ type: [DispositifResponse] })
  dispositifs!: DispositifResponse[];

  @ApiProperty({ description: "Stats par type de dispositif" })
  stats!: Record<string, DispositifStatsResponse>;
}
