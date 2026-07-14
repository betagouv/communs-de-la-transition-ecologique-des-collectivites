import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ServiceApiKeyGuard } from "@/auth/service-api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { AjoutsManuelsService } from "@/ajouts-manuels/ajouts-manuels.service";
import { AjoutCreeResponse } from "@/ajouts-manuels/dto/ajout-manuel.dto";
import { AjoutAideAdminRequest, AjoutServiceAdminRequest } from "./dto/admin-ajouts.dto";

/**
 * Ajouter ou retirer un ajout manuel DEPUIS LE BACK-OFFICE, au nom d'une plateforme.
 *
 * POURQUOI CES ENDPOINTS EXISTENT, alors que les vrais sont déjà là. Sur les endpoints partenaires,
 * la plateforme est DÉDUITE de la clé d'API — c'est ce qui empêche un service de se faire passer
 * pour un autre. Le back-office, lui, porte la clé d'ADMINISTRATION : il n'est aucune plateforme, et
 * doit donc dire au nom de QUI il agit.
 *
 * La garantie n'est pas affaiblie : elle porte sur les clés PARTENAIRES, et elle reste entière. Une
 * console d'exploitation qui agit « au nom de » est exactement ce qu'on attend d'elle — et c'est
 * pour ça qu'elle est derrière ServiceApiKeyGuard, jamais derrière une clé de plateforme.
 *
 * AUCUNE RÈGLE N'EST RÉÉCRITE ICI : on délègue à `AjoutsManuelsService`, la même porte que les
 * endpoints partenaires. Les gardes (aide sur le périmètre du projet, slug existant au catalogue)
 * s'appliquent donc à l'identique — sans quoi le back-office pourrait créer des ajouts que la
 * lecture ne saurait jamais résoudre.
 */
@ApiBearerAuth()
@ApiTags("Administration")
@Controller("admin/ajouts")
@UseGuards(ServiceApiKeyGuard)
export class AdminAjoutsController {
  constructor(private readonly ajouts: AjoutsManuelsService) {}

  @Post("aide")
  @ApiOperation({
    summary: "Ajouter une aide à un projet, au nom d'une plateforme",
    description:
      "Mêmes gardes que l'endpoint partenaire : l'aide doit être disponible sur le territoire du " +
      "projet (400 sinon). Une aide hors périmètre ne pourrait jamais être résolue à la lecture, et " +
      "l'ajout resterait invisible sans le moindre message.",
  })
  @ApiEndpointResponses({ successStatus: 201, response: AjoutCreeResponse, description: "Ajout enregistré" })
  ajouterAide(@Body() dto: AjoutAideAdminRequest): Promise<AjoutCreeResponse> {
    return this.ajouts.ajouterAide(dto.projetId, dto, dto.plateforme);
  }

  @Post("service")
  @ApiOperation({
    summary: "Ajouter un service numérique à un projet, au nom d'une plateforme",
    description: "`slug` (service du catalogue) OU `service` (service décrit à la main), exactement un des deux.",
  })
  @ApiEndpointResponses({ successStatus: 201, response: AjoutCreeResponse, description: "Ajout enregistré" })
  ajouterService(@Body() dto: AjoutServiceAdminRequest): Promise<AjoutCreeResponse> {
    return this.ajouts.ajouterService(dto.projetId, dto, dto.plateforme);
  }

  @Delete(":decisionId")
  @HttpCode(200)
  @ApiOperation({
    summary: "Retirer un ajout manuel",
    description:
      "RÉVOCATION, pas suppression : le journal est append-only. `plateforme` doit être celle qui a " +
      "fait l'ajout — on ne défait pas l'ajout d'une autre.",
  })
  retirer(
    @Param("decisionId", ParseUUIDPipe) decisionId: string,
    @Query("plateforme") plateforme: string,
  ): Promise<AjoutCreeResponse> {
    return this.ajouts.retirer(decisionId, plateforme);
  }
}
