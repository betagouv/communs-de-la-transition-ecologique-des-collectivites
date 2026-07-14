import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { DecisionsService } from "./decisions.service";
import { CreateDecisionDto, DecisionCreatedResponse, DecisionListResponse } from "./dto/create-decision.dto";
import { DECISION_TYPES, type DecisionType } from "./decision-contract";
import { TYPE_AJOUT } from "@/ajouts-manuels/ajout-manuel-contract";

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
    // `ajout_manuel` a ses propres endpoints (/projets/:id/aides|services/ajouts), et EUX SEULS
    // portent les gardes qui rendent l'ajout résoluble : l'aide doit être sur le périmètre du
    // projet, le slug doit exister au catalogue. Les court-circuiter par cette porte générique
    // produirait exactement la panne silencieuse qu'elles préviennent — un ajout enregistré, mais
    // que la lecture ne saurait jamais résoudre, donc invisible et sans message.
    if (dto.typeDecision === TYPE_AJOUT) {
      throw new BadRequestException(
        `Le type "${TYPE_AJOUT}" ne s'écrit pas ici : utilisez POST /projets/:projetId/aides/ajouts ` +
          `ou POST /projets/:projetId/services/ajouts, qui vérifient que l'objet ajouté est bien ` +
          `résoluble. Sans cette garde, l'ajout serait enregistré mais jamais affiché.`,
      );
    }
    return this.decisionsService.create(dto, request.serviceType!);
  }

  @TrackApiUsage()
  @Get()
  @ApiOperation({
    summary: "Lister les décisions par objet et/ou par type",
    description:
      "Retourne les décisions filtrées par objetId (référencé en A ou en B) ET/OU par type, " +
      "triées anté-chronologiquement (max 100). Au moins un des deux filtres est requis. " +
      "Cloisonnement : chaque plateforme ne voit QUE ses propres décisions (celles émises avec sa clé API).",
  })
  @ApiQuery({ name: "objetId", required: false, description: "ID stable de l'objet à inspecter." })
  @ApiQuery({
    name: "type",
    required: false,
    enum: DECISION_TYPES,
    description: "Type de décision à filtrer (vocabulaire fermé).",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: DecisionListResponse,
    description: "Décisions correspondant aux filtres",
  })
  find(@Req() request: Request, @Query("objetId") objetId?: string, @Query("type") type?: string) {
    if (!objetId && !type) {
      throw new BadRequestException("Au moins un filtre requis : objetId et/ou type");
    }
    if (type && !DECISION_TYPES.includes(type as DecisionType)) {
      throw new BadRequestException(`type invalide (attendu : ${DECISION_TYPES.join(", ")})`);
    }
    return this.decisionsService.find({ objetId, type }, request.serviceType!);
  }
}
