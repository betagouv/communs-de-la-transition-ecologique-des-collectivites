import { ProjectStatus, projectStatusEnum } from "@database/schema";
import { Competences, Leviers } from "@/shared/types";
import { ApiProperty } from "@nestjs/swagger";
import { leviers } from "@/shared/const/leviers";
import { competences } from "@/shared/const/competences-list";
import { Collectivite } from "@projects/dto/collectivite.dto";

export class ProjectResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ nullable: true, type: String })
  porteurCodeSiret!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
  })
  porteurReferentEmail!: string | null;

  @ApiProperty({ nullable: true, type: String })
  porteurReferentTelephone!: string | null;

  @ApiProperty({ nullable: true, type: String })
  porteurReferentPrenom!: string | null;

  @ApiProperty({ nullable: true, type: String })
  porteurReferentNom!: string | null;

  @ApiProperty({ nullable: true, type: String })
  porteurReferentFonction!: string | null;

  @ApiProperty({ type: [Collectivite] })
  collectivites!: Collectivite[];

  @ApiProperty({ nullable: true, type: Number })
  budget!: number | null;

  @ApiProperty({ nullable: true, type: String })
  forecastedStartDate!: string | null;

  @ApiProperty({ nullable: true, enum: projectStatusEnum.enumValues })
  status!: ProjectStatus | null;

  @ApiProperty({ nullable: true, type: String, enum: competences })
  competences!: Competences | null;

  @ApiProperty({
    nullable: true,
    description: "Array of leviers",
    type: String,
    enum: leviers,
  })
  leviers!: Leviers | null;

  @ApiProperty({ nullable: true, type: String })
  mecId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  tetId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  recocoId!: string | null;
}
