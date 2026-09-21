import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { collectiviteType, CollectiviteType, collectiviteTypeEnum } from "@database/schema";

export class CollectiviteReference {
  @ApiProperty({
    type: String,
    description: "Types of the collectivite",
    enum: collectiviteTypeEnum.enumValues,
    example: "Commune",
  })
  @IsIn(collectiviteType)
  type!: CollectiviteType;

  @ApiProperty({ description: "Code of the collectivite, codeInsee for communes and codeEpci/siren for EPCI" })
  @IsString()
  code!: string;

  // Identifiant interne de la collectivité côté plateforme source (TeT), fourni par le webhook TeT.
  // Nécessaire au deep-link MEC→TeT (/collectivite/:collectiviteId/...). Optionnel : toutes les
  // sources ne l'envoient pas. Accepté ici pour ne pas rejeter le payload (whitelist stricte) ;
  // la propagation/stockage pour construire le deep-link est un chantier séparé.
  @ApiPropertyOptional({
    type: String,
    description: "Identifiant interne de la collectivité côté source (ex. collectiviteId TeT), pour le deep-link.",
  })
  @IsOptional()
  @IsString()
  collectiviteId?: string;
}

export class Collectivite {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  nom!: string;

  @ApiProperty({ enum: ["Commune", "EPCI"] })
  type!: CollectiviteType;

  @ApiProperty({ nullable: true, type: String })
  codeInsee!: string | null;

  @ApiProperty({ nullable: true, type: String })
  codeEpci!: string | null;

  @ApiProperty({ nullable: true, type: String })
  codeDepartements!: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  codeRegions!: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  siren!: string | null;
}
