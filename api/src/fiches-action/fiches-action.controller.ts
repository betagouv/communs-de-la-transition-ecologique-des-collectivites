import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { CreateFicheActionRequest, CreateFicheActionResponse } from "./dto/create-fiche-action.dto";
import { FichesActionService } from "./fiches-action.service";

@ApiBearerAuth()
@ApiTags("Fiches Action")
@Controller("fiches-action")
@UseGuards(ApiKeyGuard)
export class FichesActionController {
  constructor(private readonly fichesActionService: FichesActionService) {}

  @TrackApiUsage()
  @Post()
  @ApiOperation({
    summary: "Créer ou mettre à jour une fiche action",
    description:
      "Reçoit une fiche action depuis TeT. Stocke dans le schéma data_tet et déclenche la classification automatique.",
  })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateFicheActionResponse,
    description: "Fiche action créée ou mise à jour",
  })
  async create(@Body() request: CreateFicheActionRequest): Promise<CreateFicheActionResponse> {
    return this.fichesActionService.createOrUpdate(request);
  }
}
