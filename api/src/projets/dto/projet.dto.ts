import { ProjetPhase, projetPhasesEnum, PhaseStatut, phaseStatutEnum } from "@database/schema";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { ApiProperty } from "@nestjs/swagger";
import { leviers } from "@/shared/const/leviers";
import { competenceCodes } from "@/shared/const/competences-list";
import { Collectivite } from "@projets/dto/collectivite.dto";
import { PorteurDto } from "@projets/dto/porteur.dto";
import { ValidateNested } from "class-validator";

export class ProjetResponse {
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

  @ApiProperty({ nullable: true, type: PorteurDto })
  @ValidateNested()
  porteur!: PorteurDto | null;

  @ApiProperty({ type: [Collectivite] })
  collectivites!: Collectivite[];

  @ApiProperty({ nullable: true, type: Number })
  budgetPrevisionnel!: number | null;

  @ApiProperty({ nullable: true, type: String })
  dateDebutPrevisionnelle!: string | null;

  @ApiProperty({ nullable: true, enum: phaseStatutEnum.enumValues })
  phaseStatut!: PhaseStatut | null;

  @ApiProperty({ nullable: true, enum: projetPhasesEnum.enumValues })
  phase!: ProjetPhase | null;

  @ApiProperty({ nullable: true, type: String })
  programme!: string | null;

  @ApiProperty({ nullable: true, type: String, enum: competenceCodes })
  competences!: CompetenceCodes | null;

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
