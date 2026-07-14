import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

class AjoutBase {
  @ApiPropertyOptional({
    description:
      "Pourquoi cet ajout — « recommandée par la DDT lors du COPIL du 12/03 ». Rendu tel quel au " +
      "client, à côté de l'aide ou du service concerné.",
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ description: "Identifiant de l'agent auteur, si la plateforme le transmet.", maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  auteur?: string;
}

export class AjoutAideRequest extends AjoutBase {
  @ApiProperty({
    description:
      "Identifiant Aides-territoires de l'aide. Elle doit être disponible sur le territoire du " +
      "projet (400 sinon) : une aide hors périmètre ne pourrait jamais être résolue à la lecture, " +
      "et l'ajout resterait invisible sans le moindre message.",
  })
  @IsInt()
  aideId!: number;
}

export class AjoutServiceRequest extends AjoutBase {
  @ApiProperty({ description: "Slug du service numérique, tel qu'il figure au catalogue." })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}

export class AjoutCreeResponse {
  @ApiProperty({ description: "Id de la décision. C'est lui qu'il faut fournir pour retirer l'ajout." })
  decisionId!: string;
}

/** La trace d'un ajout manuel, attachée à l'aide ou au service concerné dans les listes. */
export class AjoutManuelResponse {
  @ApiProperty({ description: "Id de la décision — à fournir pour retirer cet ajout." })
  decisionId!: string;

  @ApiPropertyOptional({ description: "Le message saisi lors de l'ajout." })
  message?: string;

  @ApiProperty({ description: "Plateforme qui a procédé à l'ajout (dérivée de la clé d'API)." })
  plateforme!: string;

  @ApiProperty({ description: "Date de l'ajout (ISO 8601)." })
  date!: string;
}
