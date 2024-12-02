import { ApiProperty } from "@nestjs/swagger";
import { projects, ProjectStatus } from "@database/schema";
import { InferSelectModel } from "drizzle-orm";

class CommuneDto {
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

  @ApiProperty()
  porteur: string | null;

  @ApiProperty()
  porteurCodeSiret: string | null;

  @ApiProperty()
  porteurReferentEmail: string | null;

  @ApiProperty()
  porteurReferentTelephone: string | null;

  @ApiProperty()
  porteurReferentPrenom: string | null;

  @ApiProperty()
  porteurReferentNom: string | null;

  @ApiProperty()
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
