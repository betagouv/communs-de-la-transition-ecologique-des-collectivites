import { CreateProjetRequest } from "./create-projet.dto";
import { ApiProperty, OmitType, PartialType } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { EtapeStatut, etapeStatutEnum } from "@database/schema";
import { SetEnCoursIfEtapeIsProvidedButNoEtapeStatut } from "@projets/decorators/etape-decorators";

class CreateProjetRequestBase extends OmitType(CreateProjetRequest, ["etapeStatut"] as const) {}

export class UpdateProjetDto extends PartialType(CreateProjetRequestBase) {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  // Redefine etapeStatut without the etapeStatutRequiresEtape validator
  // This allows updating etapeStatut independently of etape
  @ApiProperty({ required: false, nullable: true, enum: etapeStatutEnum.enumValues })
  @IsOptional()
  @SetEnCoursIfEtapeIsProvidedButNoEtapeStatut()
  etapeStatut?: EtapeStatut | null;
}
