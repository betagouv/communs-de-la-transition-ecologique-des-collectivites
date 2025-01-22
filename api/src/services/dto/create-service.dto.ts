import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUrl } from "class-validator";
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
  @IsUrl()
  logoUrl!: string;

  @ApiProperty()
  @IsUrl()
  redirectionUrl!: string;

  @ApiProperty()
  @IsString()
  redirectionLabel!: string;
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
    example: "Version control and collaboration platform",
    description:
      "Objectivez votre diagnostic avec les données socio-économiques qui rendent votre territoire unique et découvrez des arguments et ressources pour mobiliser vos collègues et partenaires externes sur l'adaptation au changement climatique.",
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
    example: "La boussole",
    description: "label of the redirection",
  })
  @IsString()
  @IsNotEmpty()
  redirectionLabel!: string;
}
