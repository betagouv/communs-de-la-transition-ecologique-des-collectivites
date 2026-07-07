import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { DecisionsService } from "./decisions.service";
import { CreateDecisionDto, DecisionCreatedResponse, DecisionListResponse } from "./dto/create-decision.dto";

@ApiBearerAuth()
@ApiTags("Décisions")
@Controller("decisions")
@UseGuards(ApiKeyGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @TrackApiUsage()
  @Post()
  @ApiOperation({
    summary: "Enregistrer une décision humaine",
    description:
      "Journal append-only : aucune mise à jour ni suppression. La plateforme émettrice " +
      "(plateformeSource) est dérivée de la clé API authentifiée, pas du corps de requête. " +
      "Les objets référencés doivent utiliser leurs IDs stables, jamais un cluster_id.",
  })
  @ApiEndpointResponses({
    successStatus: 201,
    response: DecisionCreatedResponse,
    description: "Décision enregistrée",
  })
  create(@Req() request: Request, @Body() dto: CreateDecisionDto): Promise<DecisionCreatedResponse> {
    return this.decisionsService.create(dto, request.serviceType!);
  }

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Lister les décisions portant sur un objet",
    description:
      "Retourne les décisions référençant l'objet (en A ou en B), triées anté-chronologiquement (max 100). " +
      "Cloisonnement : chaque plateforme ne voit QUE ses propres décisions (celles émises avec sa clé API).",
  })
  @ApiQuery({ name: "objetId", required: true, description: "ID stable de l'objet à inspecter." })
  @ApiEndpointResponses({
    successStatus: 200,
    response: DecisionListResponse,
    description: "Décisions portant sur l'objet",
  })
  findByObjet(@Req() request: Request, @Query("objetId") objetId?: string) {
    if (!objetId) {
      throw new BadRequestException("objetId requis");
    }
    return this.decisionsService.findByObjet(objetId, request.serviceType!);
  }
}
