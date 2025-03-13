import { ProjetEtapes, projetEtapesEnum, EtapeStatus, etapeStatusEnum } from "@database/schema";
import { Competences, Leviers } from "@/shared/types";
import { ApiProperty } from "@nestjs/swagger";
import { leviers } from "@/shared/const/leviers";
import { competences } from "@/shared/const/competences-list";
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

  @ApiProperty({ nullable: true, enum: etapeStatusEnum.enumValues })
  etapeStatus!: EtapeStatus | null;

  @ApiProperty({ nullable: true, enum: projetEtapesEnum.enumValues })
  etape!: ProjetEtapes | null;

  @ApiProperty({ nullable: true, type: String })
  programme!: string | null;

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
