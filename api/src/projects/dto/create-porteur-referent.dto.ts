import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString } from "class-validator";

export class CreatePorteurReferentDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  prenom?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  nom?: string;
}
