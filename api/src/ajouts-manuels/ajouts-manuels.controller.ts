import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { AjoutsManuelsService } from "./ajouts-manuels.service";
import { AjoutAideRequest, AjoutCreeResponse, AjoutServiceRequest } from "./dto/ajout-manuel.dto";

/**
 * Ajouter à la main une aide ou un service numérique à un projet, quand le moteur ne l'a pas trouvé.
 *
 * Ces ajouts sont des DÉCISIONS HUMAINES : ils sont écrits dans le journal append-only, avec leur
 * auteur, leur date et leur plateforme (dérivée de la clé d'API, jamais du corps de requête). Le
 * retrait est une révocation, pas une suppression — on garde la trace de ce qui a été fait.
 *
 * CLOISONNEMENT PAR PLATEFORME, comme pour toute décision : une plateforme ne voit et ne retire
 * que ses propres ajouts.
 *
 * Les ajouts remontent ensuite FONDUS dans `GET /aides?projetId=` et `GET /projets/:id/services`,
 * marqués `ajoutManuel`. Aucun endpoint de lecture séparé : sinon chaque consommateur devrait
 * refaire la fusion, et finirait par l'oublier.
 */
@ApiBearerAuth()
@ApiTags("Ajouts manuels")
@Controller("projets/:projetId")
@UseGuards(ApiKeyGuard)
export class AjoutsManuelsController {
  constructor(private readonly service: AjoutsManuelsService) {}

  @TrackApiUsage()
  @Post("aides/ajouts")
  @ApiOperation({
    summary: "Ajouter une aide à la main sur un projet",
    description:
      "L'instantané (`nom`, `url`) est OBLIGATOIRE : une aide n'est persistée dans aucune table — " +
      "elle vit en cache, rechargée depuis Aides-territoires et filtrée par le territoire du projet. " +
      "Sans instantané, l'aide ajoutée disparaîtrait le jour où Aides-territoires cesserait de la " +
      "renvoyer, sans le moindre message. À la lecture, les données fraîches priment quand l'aide " +
      "est encore connue ; l'instantané ne sert que de repli.",
  })
  @ApiEndpointResponses({ successStatus: 201, response: AjoutCreeResponse, description: "Ajout enregistré" })
  ajouterAide(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) projetId: string,
    @Body() dto: AjoutAideRequest,
  ): Promise<AjoutCreeResponse> {
    return this.service.ajouterAide(projetId, dto, request.serviceType!);
  }

  @TrackApiUsage()
  @Post("services/ajouts")
  @ApiOperation({
    summary: "Ajouter un service numérique à la main sur un projet",
    description:
      "Deux façons, et EXACTEMENT une des deux.\n\n" +
      "• `slug` — le service est AU CATALOGUE. On ne recopie rien : sa fiche reste la source de " +
      "vérité et continuera d'évoluer (logo, description, lien). Un slug inconnu est un 404.\n\n" +
      "• `service` — il n'y est PAS (outil local, service partenaire pas encore benchmarké). " +
      "L'agent le décrit lui-même : nom, description, lien. Ces informations sont figées, car " +
      "c'est lui la source — il n'y a aucune autorité extérieure à tenir en phase, contrairement " +
      "à une aide.\n\n" +
      "On ne lui demande PAS de thématiques : elles ne servent qu'à SÉLECTIONNER un service pour " +
      "un projet, et ici la sélection est déjà faite. `categories` et `thematiques` sortent donc " +
      "vides. Le drapeau `ajoutManuel.horsCatalogue` signale la PROVENANCE : ce service n'a pas de " +
      "fiche chez nous et son logo n'est pas hébergé par l'API.",
  })
  @ApiEndpointResponses({ successStatus: 201, response: AjoutCreeResponse, description: "Ajout enregistré" })
  ajouterService(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) projetId: string,
    @Body() dto: AjoutServiceRequest,
  ): Promise<AjoutCreeResponse> {
    return this.service.ajouterService(projetId, dto, request.serviceType!);
  }

  @TrackApiUsage()
  @Delete("ajouts/:decisionId")
  @ApiOperation({
    summary: "Retirer un ajout manuel",
    description:
      "RÉVOCATION, pas suppression : le journal est append-only. On enregistre un événement qui " +
      "annule le précédent, et l'ajout cesse de remonter. La trace de ce qui a été fait, et défait, " +
      "reste. Une plateforme ne peut retirer que ses propres ajouts.",
  })
  // 200, pas 201 : DELETE ne crée rien du point de vue du client. Le fait qu'on écrive une
  // nouvelle ligne dans le journal (la révocation) est un détail d'implémentation.
  @ApiEndpointResponses({ successStatus: 200, response: AjoutCreeResponse, description: "Ajout retiré" })
  retirer(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) _projetId: string,
    @Param("decisionId", ParseUUIDPipe) decisionId: string,
  ): Promise<AjoutCreeResponse> {
    return this.service.retirer(decisionId, request.serviceType!);
  }
}
