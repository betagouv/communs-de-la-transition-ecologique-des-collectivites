import { Throttle } from "@nestjs/throttler";
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { CreateFicheActionRequest, CreateFicheActionResponse } from "./dto/create-fiche-action.dto";
import { SecteursResponse } from "./secteurs/dto/secteurs.dto";
import { FichesActionService } from "./fiches-action.service";

@ApiBearerAuth()
@ApiTags("TeT")
// Routes d'ingestion partenaires (webhooks MEC/TeT) : les resyncs dépassent largement
// la limite globale 50/min — surcharge à 500/min (absorbe le burst observé).
@Throttle({ default: { limit: 500, ttl: 60000 } })
@Controller("tet/v1/actions")
@UseGuards(ApiKeyGuard)
export class FichesActionController {
  constructor(private readonly fichesActionService: FichesActionService) {}

  @TrackApiUsage()
  @Post()
  @ApiOperation({
    summary: "Créer ou mettre à jour une fiche action",
    description:
      "Reçoit une fiche action (webhook TeT). Stocke dans le schéma data_tet et déclenche la classification automatique.",
  })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateFicheActionResponse,
    description: "Fiche action créée ou mise à jour",
  })
  async create(@Body() request: CreateFicheActionRequest): Promise<CreateFicheActionResponse> {
    return this.fichesActionService.createOrUpdate(request);
  }

  @TrackApiUsage()
  @Get(":id")
  @ApiOperation({
    summary: "Récupérer une fiche action par ID",
    description:
      "Retourne la fiche action avec ses plans liés, ses IDs externes et sa classification. " +
      "Accepte l'ID interne (UUID) ou l'externalId TeT.",
  })
  async findOne(@Param("id") id: string) {
    return this.fichesActionService.findOne(id);
  }

  @TrackApiUsage()
  @Get(":id/secteurs")
  @ApiOperation({
    summary: "Secteurs réglementaires d'une fiche action",
    description:
      "Les 8 secteurs réglementaires (résidentiel, tertiaire, transport routier, autres transports, agriculture, " +
      "déchets, industrie hors branche énergie, branche énergie), calculés à la lecture depuis les labels de la " +
      "fiche (classification + leviers SGPE) via un mapping déterministe. Sémantique : le secteur que l'action " +
      "VISE (rattachement dans un plan climat — une action de sensibilisation au tri se rattache aux déchets), " +
      "pas un inventaire des émissions produites par l'activité elle-même. Convention transports (SECTEN) : " +
      "« transport routier » couvre tout véhicule sur route, y compris bus, cars, covoiturage et véhicules " +
      "électriques ; « autres transports » couvre les modes actifs (vélo, marche), le ferroviaire et le fluvial. " +
      "Deux lectures exposées : « association directe » (secteur dont relève l'objet de l'action) et " +
      "« contribution » (secteurs d'effet, reports indirects répartis). Accepte l'ID interne (UUID) ou " +
      "l'externalId TeT de la fiche.",
  })
  @ApiEndpointResponses({
    successStatus: 200,
    response: SecteursResponse,
    description: "Secteurs réglementaires de la fiche action",
  })
  async getSecteurs(@Param("id") id: string): Promise<SecteursResponse> {
    return this.fichesActionService.getSecteurs(id);
  }

  @TrackApiUsage()
  @Patch(":id")
  @ApiOperation({
    summary: "Mettre à jour partiellement une fiche action",
    description:
      "Met à jour les champs fournis sans écraser les autres. Accepte l'ID interne (UUID) ou l'externalId TeT.",
  })
  async update(
    @Param("id") id: string,
    @Body() request: Partial<CreateFicheActionRequest>,
  ): Promise<CreateFicheActionResponse> {
    return this.fichesActionService.update(id, request);
  }
}
