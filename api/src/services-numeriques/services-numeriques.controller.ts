import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ProjetServicesResponse } from "./dto/service-numerique.dto";
import { ServicesNumeriquesService } from "./services-numeriques.service";
import { SEUIL_PERTINENCE } from "./service-numerique-contract";

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
      "Services sélectionnés et ORDONNÉS par pertinence décroissante par l'API. Le client affiche la " +
      "liste telle quelle : il ne trie pas et ne refait pas la sélection (il peut proposer des filtres " +
      "par catégorie, purement à l'affichage).\n\n" +
      "Le SEUIL de pertinence est réglable (`?seuil=`), avec un défaut explicite : une plateforme peut " +
      "légitimement vouloir être plus permissive ou plus stricte. Mais c'est l'API qui l'applique — un " +
      "client qui rejouerait la règle de son côté en créerait une seconde définition, qui divergerait.\n\n" +
      "Aucun autre critère de sélection n'est exposé (classification, phases, curation). Aucun service " +
      "→ 200 avec une liste vide. Les services AJOUTÉS À LA MAIN remontent en tête, marqués " +
      "`ajoutManuel`, et échappent au seuil : quelqu'un les a délibérément mis là.",
  })
  @ApiParam({ name: "projetId", description: "Identifiant Communs du projet (UUID)." })
  @ApiQuery({
    name: "seuil",
    required: false,
    description:
      `Score de pertinence minimal, entre 0 et 1. **Défaut : ${SEUIL_PERTINENCE}** — celui que l'API applique ` +
      "si vous ne demandez rien, et celui sur lequel elle est réglée.\n\n" +
      "Une plateforme peut légitimement vouloir être plus permissive (montrer davantage, quitte à " +
      "afficher du moins pertinent) ou plus stricte. Le seuil est donc à vous — mais le DÉFAUT reste " +
      "à nous : c'est lui qui fait foi, et c'est lui qu'on règle quand la pertinence est en cause.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetServicesResponse,
    description: "Services pertinents, éventuellement vide",
  })
  findForProjet(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) projetId: string,
    @Query("seuil") seuilBrut?: string,
  ): Promise<ProjetServicesResponse> {
    return this.servicesNumeriquesService.findForProjet(
      projetId,
      origine(request),
      request.serviceType!,
      seuil(seuilBrut),
    );
  }
}

/**
 * Seuil demandé, ou celui de l'API.
 *
 * Une valeur invalide est un 400 EXPLICITE, jamais un repli silencieux sur le défaut : « ?seuil=abc »
 * qui renverrait la liste par défaut ferait croire au client que son réglage est appliqué.
 */
function seuil(brut?: string): number {
  if (brut === undefined || brut === "") return SEUIL_PERTINENCE;

  const valeur = Number(brut);
  if (Number.isNaN(valeur) || valeur < 0 || valeur > 1) {
    throw new BadRequestException(`Paramètre "seuil" invalide : attendu un nombre entre 0 et 1, reçu "${brut}".`);
  }
  return valeur;
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
