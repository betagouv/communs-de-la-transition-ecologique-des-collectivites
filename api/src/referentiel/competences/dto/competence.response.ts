import { ApiProperty } from "@nestjs/swagger";
import { GroupementSummary } from "../../communes/dto/commune.response";

export class CompetenceCategorieResponse {
  @ApiProperty({ example: "15" })
  code!: string;

  @ApiProperty({ example: "Eau et Assainissement" })
  nom!: string;
}

export class CompetenceResponse {
  @ApiProperty({ example: "1505" })
  code!: string;

  @ApiProperty({ example: "Eau (production, traitement, adduction, distribution)" })
  nom!: string;

  @ApiProperty()
  categorie!: CompetenceCategorieResponse;
}

export class CompetenceAvecGroupementResponse {
  @ApiProperty()
  competence!: CompetenceResponse;

  @ApiProperty()
  groupement!: GroupementSummary;
}
