import { ApiProperty } from "@nestjs/swagger";

export class PlanTransitionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  type!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  periodeDebut!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  periodeFin!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  collectiviteResponsableSiren!: string | null;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  territoireCommunes!: string[] | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PlanTransitionDetailResponse extends PlanTransitionResponse {
  @ApiProperty({ type: () => PlanFicheActionSummary, isArray: true })
  fichesAction!: PlanFicheActionSummary[];
}

export class PlanFicheActionSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  description!: string | null;
}
