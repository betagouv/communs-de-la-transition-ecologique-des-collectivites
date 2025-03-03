import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString } from "class-validator";
import { CollectiviteType, collectiviteTypeEnum } from "@database/schema";

export class CollectiviteReference {
  @ApiProperty({
    type: String,
    description: "Types of the collectivite",
    enum: collectiviteTypeEnum.enumValues,
    example: "Commune",
  })
  @IsEnum(collectiviteTypeEnum)
  type!: CollectiviteType;

  @ApiProperty({ description: "Code of the collectivite, codeInsee for communes and codeEpci/siren for EPCI" })
  @IsString()
  code!: string;
}

export class Collectivite {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ enum: ["Commune", "EPCI"] })
  type!: CollectiviteType;

  @ApiProperty({ nullable: true, type: String })
  codeInsee?: string | null;

  @ApiProperty({ nullable: true, type: String })
  codeEpci?: string | null;

  @ApiProperty({ nullable: true, type: String })
  codeDepartements?: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  codeRegions?: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  siren?: string | null;
}
