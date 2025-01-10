import { ApiProperty } from "@nestjs/swagger";
import { ProjectStatus } from "@database/schema";
import { CompetencesWithSousCompetences } from "@/shared/types";

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

  @ApiProperty({ nullable: true })
  porteurCodeSiret!: string | null;

  @ApiProperty({
    nullable: true,
  })
  porteurReferentEmail!: string | null;

  @ApiProperty({ nullable: true })
  porteurReferentTelephone!: string | null;

  @ApiProperty({ nullable: true })
  porteurReferentPrenom!: string | null;

  @ApiProperty({ nullable: true })
  porteurReferentNom!: string | null;

  @ApiProperty({ nullable: true })
  porteurReferentFonction!: string | null;

  @ApiProperty()
  communes!: Commune[];

  @ApiProperty()
  budget!: number;

  @ApiProperty()
  forecastedStartDate!: string;

  @ApiProperty()
  status!: ProjectStatus;

  @ApiProperty({ nullable: true })
  competencesAndSousCompetences!: CompetencesWithSousCompetences | null;
}
