import { ApiProperty } from "@nestjs/swagger";

export class GroupementResponse {
  @ApiProperty({ description: "SIREN (9 chiffres)", example: "200065928" })
  siren!: string;

  @ApiProperty({ example: "Lannion-Trégor Communauté" })
  nom!: string;

  @ApiProperty({ description: "Type juridique", example: "CA" })
  type!: string;

  @ApiProperty({ example: 103000, nullable: true })
  population!: number | null;

  @ApiProperty({ example: 57, nullable: true })
  nbCommunes!: number | null;

  @ApiProperty({ example: ["22"] })
  departements!: string[];

  @ApiProperty({ example: ["53"] })
  regions!: string[];

  @ApiProperty({ example: "Fiscalité professionnelle unique", nullable: true })
  modeFinancement!: string | null;

  @ApiProperty({ example: "2017-01-01", nullable: true })
  dateCreation!: string | null;
}

export class MembreResponse {
  @ApiProperty({ example: "22006" })
  code!: string;

  @ApiProperty({ example: "Bégard" })
  nom!: string;

  @ApiProperty({ example: 4832, nullable: true })
  population!: number | null;

  @ApiProperty({ example: "commune" })
  categorieMembre!: string;
}
