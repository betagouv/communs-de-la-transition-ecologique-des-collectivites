import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsEmail,
  Matches,
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

  @ApiProperty()
  @IsString()
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
  // todo - confirm regex
  @Matches(/^\d{2,3}[A-Z]?\d{3}$/, {
    each: true,
    message:
      'Each INSEE code must be in the correct format (e.g., "01001", "75056", or "97A01")',
  })
  communeInseeCodes: string[];
}
