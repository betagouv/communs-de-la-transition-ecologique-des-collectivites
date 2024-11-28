import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { ProjectStatus, projectStatusEnum } from "@database/schema";
import { CreatePorteurReferentDto } from "@projects/dto/create-porteur-referent.dto";

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  codeSiret: string;

  @ApiProperty()
  @IsOptional()
  porteurReferent?: CreatePorteurReferentDto;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  budget: number;

  @ApiProperty({
    description: "Forecasted start date in YYYY-MM-DD format",
    example: "2024-03-01",
    type: String,
  })
  @IsDateString(
    {},
    {
      message: "Date must be in YYYY-MM-DD format (e.g., 2024-03-01)",
    },
  )
  forecastedStartDate: string;

  @ApiProperty({ enum: projectStatusEnum.enumValues })
  @IsEnum(projectStatusEnum.enumValues)
  status: ProjectStatus;

  @ApiProperty({
    type: [String],
    description: "Array of INSEE codes for the communes",
    example: ["01001", "75056", "97A01"],
  })
  @IsArray()
  @IsString({ each: true })
  communeInseeCodes: string[];
}
