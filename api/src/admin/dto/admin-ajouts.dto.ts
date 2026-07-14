import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";
import { AjoutAideRequest, AjoutServiceRequest } from "@/ajouts-manuels/dto/ajout-manuel.dto";

/**
 * Les DTO partenaires, plus le projet et la plateforme.
 *
 * Sur les endpoints partenaires, ces deux-là viennent de l'URL et de la clé d'API. Le back-office
 * n'est aucune plateforme : il doit les DÉCLARER. On étend le DTO plutôt que de le recopier — les
 * règles de validation (instantané, exclusivité slug/service, longueur du message) restent définies
 * une seule fois.
 */
export class AjoutAideAdminRequest extends AjoutAideRequest {
  @ApiProperty({ description: "Projet auquel attacher l'aide." })
  @IsUUID()
  projetId!: string;

  @ApiProperty({ description: "Au nom de quelle plateforme (MEC, TET…). Les ajouts sont cloisonnés par plateforme." })
  @IsString()
  @IsNotEmpty()
  plateforme!: string;
}

export class AjoutServiceAdminRequest extends AjoutServiceRequest {
  @ApiProperty({ description: "Projet auquel attacher le service." })
  @IsUUID()
  projetId!: string;

  @ApiProperty({ description: "Au nom de quelle plateforme (MEC, TET…)." })
  @IsString()
  @IsNotEmpty()
  plateforme!: string;
}
