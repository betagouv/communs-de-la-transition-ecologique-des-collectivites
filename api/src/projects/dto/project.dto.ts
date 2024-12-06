import { ApiProperty } from "@nestjs/swagger";
import { ProjectStatus } from "@database/schema";

class Commune {
  @ApiProperty()
  inseeCode: string;
}

export class ProjectResponse {
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

  @ApiProperty({ type: [Commune] })
  communes: Commune[];

  @ApiProperty()
  budget: number;

  @ApiProperty()
  forecastedStartDate: string;

  @ApiProperty()
  status: ProjectStatus;
}
