import { ApiProperty } from "@nestjs/swagger";
import { communes, projects, ProjectStatus } from "@database/schema";
import { InferSelectModel } from "drizzle-orm";

class CommuneDto implements InferSelectModel<typeof communes> {
  @ApiProperty()
  inseeCode: string;
}

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

  @ApiProperty({
    type: String || null,
  })
  porteurCodeSiret: string | null;

  @ApiProperty({
    type: String || null,
  })
  porteurReferentEmail: string | null;

  @ApiProperty({
    type: String || null,
  })
  porteurReferentTelephone: string | null;

  @ApiProperty({
    type: String || null,
  })
  porteurReferentPrenom: string | null;

  @ApiProperty({
    type: String || null,
  })
  porteurReferentNom: string | null;

  @ApiProperty({
    type: String || null,
  })
  porteurReferentFonction: string | null;

  @ApiProperty({ type: [CommuneDto] })
  communes: CommuneDto[];

  @ApiProperty()
  budget: number;

  @ApiProperty()
  forecastedStartDate: string;

  @ApiProperty()
  status: ProjectStatus;
}
