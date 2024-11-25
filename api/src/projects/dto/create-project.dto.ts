import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { ProjectStatus } from "@database/schema";

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
  @IsEmail()
  porteurEmail: string;

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

  @ApiProperty({ enum: ProjectStatus })
  @IsEnum(ProjectStatus)
  status: keyof typeof ProjectStatus;

  @ApiProperty({
    type: [String],
    description: "Array of INSEE codes for the communes",
    example: ["01001", "75056", "97A01"],
  })
  @IsArray()
  @IsString({ each: true })
  communeInseeCodes: string[];
}
