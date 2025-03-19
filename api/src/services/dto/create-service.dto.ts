import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";
import { InferInsertModel } from "drizzle-orm";
import { services } from "@database/schema";

export class CreateServiceResponse {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  sousTitre!: string;

  @ApiProperty()
  @IsUrl()
  logoUrl!: string;

  @ApiProperty()
  @IsUrl()
  redirectionUrl!: string;

  @ApiProperty({ nullable: true })
  @IsString()
  redirectionLabel!: string | null;

  @ApiProperty({ nullable: true })
  iframeUrl!: string | null;

  @ApiProperty({ nullable: true })
  extendLabel!: string | null;
}

export class CreateServiceRequest implements InferInsertModel<typeof services> {
  @ApiProperty({
    example: "Facili-Tacct",
    description: "The name of the service",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: "Docurba centralise les ressources nécessaires à chaque étape de vos procédures d'urbanisme",
    description:
      "Objectivez votre diagnostic avec les données socio-économiques qui rendent votre territoire unique et découvrez des arguments et ressources pour mobiliser vos collègues et partenaires externes sur l'adaptation au changement climatique.",
  })
  @IsString()
  @IsNotEmpty()
  sousTitre!: string;

  @ApiProperty({
    example:
      "Docurba est l’outil de transformation de la planification territoriale. Il facilite la collaboration entre services de l’Etat, collectivités et bureaux d’études pour faciliter l’élaboration et le suivi d’un document d’urbanisme afin que les enjeux et les politiques publiques soient plus rapidement et mieux pris en compte au niveau local.",
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: "https://facili-tacct.beta.gouv.fr/_next/static/media/favicon.f453a8cf.svg",
    description: "The URL of the service logo",
  })
  @IsUrl()
  @IsNotEmpty()
  logoUrl!: string;

  @ApiProperty({
    example: "https://www.boussole-te.ecologie.gouv.fr/",
    description: "The URL of the service",
  })
  @IsUrl()
  @IsNotEmpty()
  redirectionUrl!: string;

  @ApiProperty({
    example: "Découvrez la boussole",
    description: "label of the redirection",
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  redirectionLabel?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  iframeUrl?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  extendLabel?: string | null;

  @ApiProperty({
    description: "Whether the service will be associated with projects",
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isListed?: boolean;
}
