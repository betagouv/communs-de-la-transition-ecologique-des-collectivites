import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { RECOMMANDATION_VERDICTS, type RecommandationVerdict } from "@/decisions/decision-contract";

export class FinancementResponse {
  @ApiPropertyOptional()
  icone?: string;

  @ApiProperty()
  libelle!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ format: "uri" })
  url!: string;
}

export class RessourceResponse {
  @ApiPropertyOptional()
  icone?: string;

  @ApiProperty()
  source!: string;

  @ApiProperty()
  nom!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ format: "uri" })
  url!: string;
}

export class RecommandationSourceResponse {
  @ApiProperty({
    description:
      "Famille de source (ex. « questionnaire »). DESCRIPTIF, non structurant : le client peut s'en " +
      "servir pour grouper ou étiqueter l'affichage, mais n'en dépend pas fonctionnellement. Une " +
      "recommandation se tranche par son seul id, sans référence à sa source.",
    example: "questionnaire",
  })
  type!: string;

  @ApiPropertyOptional({ description: "Identifiant dans la source (ex. slug du questionnaire d'origine)." })
  ref?: string;

  @ApiPropertyOptional({ description: "Libellé affichable de la source.", example: "AtoutBiodiv" })
  libelle?: string;
}

export class RecommandationResponse {
  @ApiProperty({
    description:
      "Unique à l'échelle du PROJET, toutes sources confondues, et DÉTERMINISTE : le même contexte " +
      "produit toujours le même id. C'est ce qui permet à l'arbitrage de survivre à la disparition " +
      "puis à la réapparition d'une recommandation.",
    example: "questionnaire:atoutbiodiv-salle:haies",
  })
  id!: string;

  @ApiProperty({ type: RecommandationSourceResponse })
  source!: RecommandationSourceResponse;

  @ApiPropertyOptional({ description: "Emoji." })
  icone?: string;

  @ApiProperty()
  titre!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: [FinancementResponse] })
  financements!: FinancementResponse[];

  @ApiProperty({ type: [RessourceResponse] })
  ressources!: RessourceResponse[];

  @ApiProperty({ description: "Formulation de l'engagement, affichée lorsque decision = integree." })
  engagement!: string;

  @ApiProperty({
    enum: RECOMMANDATION_VERDICTS,
    nullable: true,
    description: "Décision courante de la collectivité. null = non tranchée.",
  })
  decision!: RecommandationVerdict | null;
}

export class ProjetRecommandationsResponse {
  @ApiProperty({ type: [RecommandationResponse] })
  recommandations!: RecommandationResponse[];
}

export class PutDecisionRequest {
  @ApiProperty({
    enum: RECOMMANDATION_VERDICTS,
    nullable: true,
    description:
      "Décision à enregistrer. null efface la décision (retour à « non tranchée ») — techniquement une " +
      "RÉVOCATION dans le journal append-only des décisions humaines, jamais une suppression de ligne.",
  })
  @IsOptional()
  @IsIn(RECOMMANDATION_VERDICTS)
  decision!: RecommandationVerdict | null;
}
