import { ApiProperty } from "@nestjs/swagger";

export class RechercheResultItem {
  @ApiProperty({ description: "Identifiant principal (code_insee ou siren)" })
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ description: "Type d'entité", example: "COM" })
  type!: string;

  @ApiProperty({ enum: ["commune", "groupement"] })
  famille!: string;

  @ApiProperty({ description: "Score de similarité (0-1)", example: 0.85 })
  score!: number;
}

export class RechercheResponse {
  @ApiProperty({ type: [RechercheResultItem] })
  communes!: RechercheResultItem[];

  @ApiProperty({ type: [RechercheResultItem] })
  groupements!: RechercheResultItem[];
}
