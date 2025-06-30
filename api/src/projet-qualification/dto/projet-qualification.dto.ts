import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { competenceCodes, competenceNames } from "@/shared/const/competences-list";
import { CompetenceCode, CompetenceName } from "@/shared/types";

export class ProjetQualificationRequest {
  @ApiProperty({
    description: "Description du projet à analyser",
    example: "Rénovation énergétique d'un bâtiment public avec installation de panneaux solaires",
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    description: "Nom du projet à analyser",
  })
  @IsString()
  @IsNotEmpty()
  nom!: string;
}

export class CompetenceDto {
  @ApiProperty({
    enum: competenceCodes,
    description: "Code de la compétence",
    type: String,
  })
  code!: CompetenceCode;

  @ApiProperty({
    enum: competenceNames,
    type: String,
    description: "Nom de la compétence",
    example: "Aménagement et services urbains > Espaces verts urbains",
  })
  nom!: CompetenceName;

  @ApiProperty({
    description: "Score de pertinence entre 0 et 1",
    example: 0.9,
  })
  score!: number;
}

export class ProjetQualificationResponse {
  @ApiProperty({
    description: "Description du projet analysé",
    example: "Rénovation énergétique d'un bâtiment public avec installation de panneaux solaires",
  })
  projet!: string;

  @ApiProperty({
    description: "Liste des compétences identifiées",
    type: [CompetenceDto],
  })
  competences!: CompetenceDto[];
}
