import { ApiProperty } from "@nestjs/swagger";
import { projects, ProjectStatus } from "@database/schema";
import { InferSelectModel } from "drizzle-orm";

export class ProjectDto implements InferSelectModel<typeof projects> {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  nom: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  codeSiret: string;

  @ApiProperty()
  porteurEmailHash: string;

  @ApiProperty()
  budget: number;

  @ApiProperty({
    description: "Forecasted start date in YYYY-MM-DD format",
    example: "2024-03-01",
  })
  forecastedStartDate: string;

  @ApiProperty({ enum: ["DRAFT", "READY", "IN_PROGRESS", "DONE", "CANCELLED"] })
  status: keyof typeof ProjectStatus;

  @ApiProperty({
    type: [String],
    description: "Array of INSEE codes for the communes",
    example: ["01001", "75056", "97A01"],
  })
  communeInseeCodes: string[];
}
