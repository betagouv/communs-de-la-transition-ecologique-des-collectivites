import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const SIREN =
  "SIREN de la collectivité qui exerce les compétences de ce territoire. Une collectivité unique porte celles du " +
  "département et de la région : Collectivité de Corse (2A, 2B, 94), de Martinique et de Guyane, Département de " +
  "Mayotte. Bas-Rhin et Haut-Rhin : Collectivité européenne d'Alsace. Paris : Ville de Paris, même SIREN que la commune.";

export class DepartementSummary {
  @ApiProperty({ description: "Code INSEE du département", example: "22" })
  code!: string;

  @ApiProperty({ example: "Côtes-d'Armor" })
  nom!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: SIREN, example: "222200014" })
  siren!: string | null;
}

export class DepartementResponse extends DepartementSummary {
  @ApiProperty({ example: "53" })
  codeRegion!: string;

  @ApiProperty({ example: "Bretagne" })
  nomRegion!: string;
}

export class RegionResponse {
  @ApiProperty({ description: "Code INSEE de la région", example: "53" })
  code!: string;

  @ApiProperty({ example: "Bretagne" })
  nom!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: SIREN, example: "233500016" })
  siren!: string | null;
}

export class RegionDetailResponse extends RegionResponse {
  @ApiProperty({ type: [DepartementSummary] })
  departements!: DepartementSummary[];
}
