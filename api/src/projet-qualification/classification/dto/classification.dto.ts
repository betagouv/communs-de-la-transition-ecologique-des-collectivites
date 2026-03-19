import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsIn, Min, Max } from "class-validator";

export class ClassificationRequest {
  @ApiProperty({ description: "Nom du projet ou de l'aide à classifier" })
  @IsString()
  @IsNotEmpty()
  nom!: string;

  @ApiProperty({ description: "Description du projet ou de l'aide à classifier" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: "Type de contenu à classifier",
    enum: ["projet", "aide"],
    default: "projet",
  })
  @IsOptional()
  @IsIn(["projet", "aide"])
  type?: "projet" | "aide";

  @ApiPropertyOptional({
    description: "Score minimum pour inclure un label (défaut: 0.8, non appliqué pour les aides)",
    default: 0.8,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  scoreThreshold?: number;
}

export class ClassificationLabelDto {
  @ApiProperty({ description: "Nom du label", example: "Energies renouvelables" })
  label!: string;

  @ApiProperty({ description: "Score de pertinence entre 0 et 1", example: 0.85 })
  score!: number;
}

export class ClassificationResponse {
  @ApiProperty({ description: "Texte du projet/aide analysé" })
  projet!: string;

  @ApiProperty({ description: "Thématiques identifiées", type: [ClassificationLabelDto] })
  thematiques!: ClassificationLabelDto[];

  @ApiProperty({ description: "Sites/lieux identifiés", type: [ClassificationLabelDto] })
  sites!: ClassificationLabelDto[];

  @ApiProperty({ description: "Interventions/modalités identifiées", type: [ClassificationLabelDto] })
  interventions!: ClassificationLabelDto[];

  @ApiProperty({
    description: "Probabilité que le projet soit lié à la transition écologique (0-1)",
    nullable: true,
    example: 0.85,
  })
  probabiliteTE!: number | null;
}
