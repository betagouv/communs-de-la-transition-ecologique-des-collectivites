import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// Une trace = une occurrence d'un projet réel dans une source (MEC, TeT, Vivier COP,
// financements DGCL/Fonds Vert…). Plusieurs traces d'un même groupe décrivent le même
// projet réel dédupliqué.
export class TerritoireTraceDto {
  @ApiProperty({ enum: ["projet", "financement"], description: "Rôle de la trace dans le groupe." })
  role!: "projet" | "financement";

  @ApiProperty({ description: "Source d'origine (source_origine)." })
  source!: string;

  @ApiProperty({ description: "ID stable de la trace." })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  nom!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Statut de phase (phaseStatut)." })
  statut!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phase!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: "Budget prévisionnel plafonné." })
  budgetPrevisionnel!: number | null;

  @ApiPropertyOptional({ nullable: true, description: "Millésime COP (cop_millesime)." })
  copMillesime!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "Statut vivier COP (cop_statut_vivier)." })
  copStatutVivier!: string | null;

  @ApiPropertyOptional({ nullable: true, description: "External ID MEC (traces MEC uniquement)." })
  externalId!: string | null;
}

export class TerritoireGroupeDto {
  @ApiPropertyOptional({
    enum: ["CERTAIN", "PROBABLE"],
    nullable: true,
    description: "Confiance du cluster ; null pour un groupe singleton (projet sans cluster).",
  })
  confiance!: "CERTAIN" | "PROBABLE" | null;

  @ApiProperty({ type: [TerritoireTraceDto] })
  traces!: TerritoireTraceDto[];
}

export class TerritoireProjetsResponse {
  @ApiProperty({ description: "Nombre total de groupes correspondant aux filtres." })
  total!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  offset!: number;

  @ApiProperty({ type: [TerritoireGroupeDto] })
  groupes!: TerritoireGroupeDto[];
}
