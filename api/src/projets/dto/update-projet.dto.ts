import { CreateProjetRequest } from "./create-projet.dto";
import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateProjetRequest extends PartialType(CreateProjetRequest) {
  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  externalId!: string;
}
