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

  @ApiPropertyOptional({ type: Number, nullable: true, description: "Probabilité de transition écologique (0–1)." })
  llmProbabiliteTe!: number | null;

  @ApiPropertyOptional({ nullable: true, description: "Horodatage de classification LLM (ISO 8601)." })
  llmClassifiedAt!: string | null;
}
