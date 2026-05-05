import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateAideFeedbackRequest {
  @ApiProperty({ description: "ID du projet (communId)" })
  @IsUUID()
  @IsNotEmpty()
  projetId!: string;

  @ApiProperty({ description: "ID Aides Territoires de l'aide" })
  @IsString()
  @IsNotEmpty()
  idAt!: string;

  @ApiPropertyOptional({ description: "Type de feedback", default: "not_relevant" })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ description: "Raison du feedback (expired, wrong_territory, wrong_theme, other)" })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: "Source du feedback (MEC, etc.)", default: "MEC" })
  @IsOptional()
  @IsString()
  source?: string;
}

export class DeleteAideFeedbackRequest {
  @ApiProperty({ description: "ID du projet" })
  @IsUUID()
  @IsNotEmpty()
  projetId!: string;

  @ApiProperty({ description: "ID Aides Territoires de l'aide" })
  @IsString()
  @IsNotEmpty()
  idAt!: string;
}

export class AideFeedbackResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projetId!: string;

  @ApiProperty()
  idAt!: string;

  @ApiProperty()
  feedback!: string;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiPropertyOptional()
  source?: string | null;

  @ApiProperty()
  createdAt!: Date;
}
