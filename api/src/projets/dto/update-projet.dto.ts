import { CreateProjetRequest } from "./create-projet.dto";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { EtapeStatus, etapeStatusEnum } from "@database/schema";
import { SetEtapeStatusEnCours } from "@projets/decorators/etape-decorators";

class CreateProjetRequestBase extends OmitType(CreateProjetRequest, ["etapeStatus"] as const) {}

export class UpdateProjetDto extends PartialType(CreateProjetRequestBase) {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  // Redefine etapeStatus without the EtapeStatusRequiresEtape validator
  // This allows updating etapeStatus independently of etape
  @ApiProperty({ required: false, nullable: true, enum: etapeStatusEnum.enumValues })
  @IsOptional()
  @SetEtapeStatusEnCours()
  etapeStatus?: EtapeStatus | null;
}
