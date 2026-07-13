import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ProjetServicesResponse } from "./dto/service-numerique.dto";
import { ServicesNumeriquesService } from "./services-numeriques.service";

@ApiBearerAuth()
@ApiTags("Services numériques")
@Controller("projets/:projetId/services")
@UseGuards(ApiKeyGuard)
export class ServicesNumeriquesController {
  constructor(private readonly servicesNumeriquesService: ServicesNumeriquesService) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Services numériques pertinents pour un projet",
    description:
      "Renvoie les services déjà sélectionnés, curés et ORDONNÉS par pertinence décroissante par l'API. " +
      "Le client affiche la liste telle quelle : il ne filtre ni ne trie (il peut proposer des filtres par " +
      "catégorie, purement côté client). Aucun critère de sélection n'est exposé. Aucun service → 200 avec " +
      "une liste vide.",
  })
  @ApiParam({ name: "projetId", description: "Identifiant Communs du projet (UUID)." })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetServicesResponse,
    description: "Services pertinents, éventuellement vide",
  })
  findForProjet(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) projetId: string,
  ): Promise<ProjetServicesResponse> {
    return this.servicesNumeriquesService.findForProjet(projetId, origine(request));
  }
}

/**
 * Origine publique de l'API, pour rendre absolues les URLs de logos qu'elle héberge.
 *
 * `request.protocol` vaut « http » derrière le terminateur TLS de Scalingo (Express ne fait
 * pas confiance au proxy par défaut). S'en contenter produirait des URLs en http sur une page
 * servie en https — donc du contenu mixte, bloqué par le navigateur. On lit donc d'abord
 * `x-forwarded-proto`, que le proxy renseigne.
 */
function origine(request: Request): string {
  const protocole = (request.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? request.protocol;
  return `${protocole}://${request.get("host") ?? ""}`;
}
