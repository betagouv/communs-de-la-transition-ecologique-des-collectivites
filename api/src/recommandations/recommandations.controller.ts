import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { ProjetRecommandationsResponse, PutDecisionRequest } from "./dto/recommandation.dto";
import { RecommandationsService } from "./recommandations.service";

@ApiBearerAuth()
@ApiTags("Recommandations")
@Controller("projets/:projetId/recommandations")
@UseGuards(ApiKeyGuard)
export class RecommandationsController {
  constructor(private readonly recommandationsService: RecommandationsService) {}

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Recommandations d'un projet, toutes sources agrégées",
    description:
      "Renvoie TOUTES les recommandations du projet, déjà sélectionnées et agrégées par l'API, avec leur " +
      "décision courante. Le client affiche la liste telle quelle : il ne recalcule ni ne filtre jamais. " +
      "Aucune recommandation → 200 avec une liste vide.",
  })
  @ApiParam({ name: "projetId", description: "Identifiant Communs du projet (UUID)." })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetRecommandationsResponse,
    description: "Recommandations du projet, éventuellement vide",
  })
  findForProjet(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) projetId: string,
  ): Promise<ProjetRecommandationsResponse> {
    return this.recommandationsService.findForProjet(projetId, request.serviceType!);
  }

  @TrackApiUsage()
  @Put(":recommandationId/decision")
  @ApiOperation({
    summary: "Tranche une recommandation (ciblée par son seul id)",
    description:
      "La recommandation est désignée par son seul id, unique à l'échelle du projet, sans référence à sa " +
      "source. `decision: null` efface la décision. L'arbitrage est journalisé en append-only " +
      "(decisions_humaines) : la plateforme émettrice est dérivée de la clé API, jamais du corps de requête.",
  })
  @ApiParam({ name: "projetId", description: "Identifiant Communs du projet (UUID)." })
  @ApiParam({
    name: "recommandationId",
    description: "Id de la recommandation, unique à l'échelle du projet.",
    example: "questionnaire:atoutbiodiv-salle:haies",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: ProjetRecommandationsResponse,
    description: "Recommandations à jour",
  })
  trancher(
    @Req() request: Request,
    @Param("projetId", ParseUUIDPipe) projetId: string,
    @Param("recommandationId") recommandationId: string,
    @Body() dto: PutDecisionRequest,
  ): Promise<ProjetRecommandationsResponse> {
    return this.recommandationsService.trancher(projetId, recommandationId, dto.decision ?? null, request.serviceType!);
  }
}
