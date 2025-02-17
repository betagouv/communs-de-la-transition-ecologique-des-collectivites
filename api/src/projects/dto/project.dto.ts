import { ProjectStatus } from "@database/schema";
import { Competences, Leviers } from "@/shared/types";
import { ApiProperty } from "@nestjs/swagger";

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

  @ApiProperty({ nullable: true })
  description!: string | null;

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

  @ApiProperty({ nullable: true })
  budget!: number | null;

  @ApiProperty({ nullable: true })
  forecastedStartDate!: string | null;

  @ApiProperty({ nullable: true })
  status!: ProjectStatus | null;

  @ApiProperty({ nullable: true })
  competences!: Competences | null;

  @ApiProperty({
    nullable: true,
    description: "Array of leviers",
  })
  leviers!: Leviers | null;

  @ApiProperty({ nullable: true })
  mecId!: string | null;

  @ApiProperty({ nullable: true })
  tetId!: string | null;

  @ApiProperty({ nullable: true })
  recocoId!: string | null;
}
