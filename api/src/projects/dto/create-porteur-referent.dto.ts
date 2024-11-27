import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString } from "class-validator";

export class CreatePorteurReferentDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  telephone?: string;

  @ApiProperty()
  @IsString()
  prenom?: string;

  @ApiProperty()
  @IsString()
  nom?: string;
}
