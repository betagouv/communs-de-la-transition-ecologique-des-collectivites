import { ApiProperty } from "@nestjs/swagger";
import { Competences, ProjectStatus, SousCompetences } from "@database/schema";

class Commune {
  @ApiProperty()
  inseeCode!: string;
}

export class ProjectResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  nom!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ type: String, nullable: true })
  porteurCodeSiret!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
  })
  porteurReferentEmail!: string | null;

  @ApiProperty({ type: String, nullable: true })
  porteurReferentTelephone!: string | null;

  @ApiProperty({ type: String, nullable: true })
  porteurReferentPrenom!: string | null;

  @ApiProperty({ type: String, nullable: true })
  porteurReferentNom!: string | null;

  @ApiProperty({ type: String, nullable: true })
  porteurReferentFonction!: string | null;

  @ApiProperty({ type: [Commune] })
  communes!: Commune[];

  @ApiProperty()
  budget!: number;

  @ApiProperty()
  forecastedStartDate!: string;

  @ApiProperty()
  status!: ProjectStatus;

  @ApiProperty({ type: String, nullable: true })
  competences!: Competences | null;

  @ApiProperty({ type: String, nullable: true })
  sousCompetences!: SousCompetences | null;
}
