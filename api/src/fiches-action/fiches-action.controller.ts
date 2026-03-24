import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
    description: "Retourne la fiche action avec ses plans liés, ses IDs externes et sa classification.",
  })
  async findOne(@Param("id") id: string) {
    return this.fichesActionService.findOne(id);
  }

  @TrackApiUsage()
  @Patch(":id")
  @ApiOperation({
    summary: "Mettre à jour partiellement une fiche action",
    description: "Met à jour les champs fournis sans écraser les autres.",
  })
  async update(
    @Param("id") id: string,
    @Body() request: Partial<CreateFicheActionRequest>,
  ): Promise<CreateFicheActionResponse> {
    return this.fichesActionService.update(id, request);
  }
}
