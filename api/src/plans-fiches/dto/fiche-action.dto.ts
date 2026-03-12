import { ApiProperty } from "@nestjs/swagger";

export class FicheActionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  statut!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  collectiviteResponsableSiren!: string | null;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  territoireCommunes!: string[] | null;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  classificationThematiques!: string[] | null;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  tcSecteurs!: string[] | null;

  @ApiProperty({ required: false, nullable: true, type: [String] })
  tcTypesPorteur!: string[] | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  tcTypeAction!: string | null;

  @ApiProperty({ required: false, nullable: true, type: String })
  tcCibleAction!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class FicheActionDetailResponse extends FicheActionResponse {
  @ApiProperty({ type: () => FichePlanSummary, isArray: true })
  plansTransition!: FichePlanSummary[];
}

export class FichePlanSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  type!: string | null;
}
