import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class QualificationResponse {
  @ApiProperty({ description: "External ID MEC interrogé." })
  externalId!: string;

  @ApiProperty({ description: "ID stable du projet dans le schéma commun." })
  projetId!: string;

  @ApiProperty({ type: [String], description: "Leviers SGPE (colonne CSV découpée en tableau)." })
  leviersSgpe!: string[];

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: "Thématiques LLM (jsonb tel quel : [{ label, score }]).",
  })
  llmThematiques!: unknown;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      "Sites LLM (jsonb tel quel — taxonomie des sites, 60 labels). Éléments : { label, score }, avec une clé additionnelle possible `nom_propre` (nom propre du site). Ne parsez pas en mode strict.",
  })
  llmSites!: unknown;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: "Interventions LLM (jsonb tel quel : [{ label, score }] — taxonomie des interventions, 15 labels).",
  })
  llmInterventions!: unknown;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      "Leviers prédits par nos modèles (jsonb : [{ label, score }], scores 0–1). Distinct de leviersSgpe (déclaratif MEC) : filtrez selon vos seuils. null tant que la prédiction n'a pas été livrée.",
  })
  llmLeviers!: unknown;

  @ApiPropertyOptional({ type: Number, nullable: true, description: "Probabilité de transition écologique (0–1)." })
  llmProbabiliteTe!: number | null;

  @ApiPropertyOptional({ nullable: true, description: "Horodatage de classification LLM (ISO 8601)." })
  llmClassifiedAt!: string | null;
}
