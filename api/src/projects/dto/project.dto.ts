import { ApiProperty } from "@nestjs/swagger";
import { projects, ProjectStatus, projectStatusEnum } from "@database/schema";
import { InferSelectModel } from "drizzle-orm";

class PorteurReferentDto {
  @ApiProperty()
  email: string;

  @ApiProperty()
  telephone: string | null;

  @ApiProperty()
  prenom: string | null;

  @ApiProperty()
  nom: string | null;
}

class CommuneDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  inseeCode: string;
}

export class ProjectDto
  implements Omit<InferSelectModel<typeof projects>, "porteurReferentId">
{
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

  @ApiProperty({ type: PorteurReferentDto })
  porteurReferent: PorteurReferentDto | null;

  @ApiProperty({ type: [CommuneDto] })
  communes: CommuneDto[];

  @ApiProperty()
  budget: number;

  @ApiProperty({
    description: "Forecasted start date in YYYY-MM-DD format",
    example: "2024-03-01",
  })
  forecastedStartDate: string;

  @ApiProperty({ enum: projectStatusEnum.enumValues })
  status: ProjectStatus;
}
