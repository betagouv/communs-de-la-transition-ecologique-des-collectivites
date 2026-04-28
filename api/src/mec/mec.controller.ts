import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiKeyGuard } from "@/auth/api-key-guard";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import {
  CreateMecProjetRequest,
  CreateMecProjetResponse,
  BulkCreateMecProjetsRequest,
  BulkCreateMecProjetsResponse,
} from "./dto/create-mec-projet.dto";
import { MecService } from "./mec.service";

@ApiBearerAuth()
@ApiTags("MEC")
@Controller("mec/v1/projets")
@UseGuards(ApiKeyGuard)
export class MecController {
  constructor(private readonly mecService: MecService) {}

  @TrackApiUsage()
  @Post()
  @ApiOperation({
    summary: "Créer ou mettre à jour un projet MEC",
    description:
      "Reçoit un projet opérationnel depuis MEC. Stocke dans le schéma data_mec et déclenche la classification automatique.",
  })
  @ApiEndpointResponses({
    successStatus: 201,
    response: CreateMecProjetResponse,
    description: "Projet MEC créé ou mis à jour",
  })
  async create(@Body() request: CreateMecProjetRequest): Promise<CreateMecProjetResponse> {
    return this.mecService.createOrUpdate(request);
  }

  @TrackApiUsage()
  @Post("bulk")
  @ApiOperation({
    summary: "Créer ou mettre à jour des projets MEC en masse",
    description: "Traitement par lots de 500. Chaque projet est upsert individuellement.",
  })
  @ApiEndpointResponses({
    successStatus: 201,
    response: BulkCreateMecProjetsResponse,
    description: "Projets MEC créés ou mis à jour en masse",
  })
  async createBulk(@Body() request: BulkCreateMecProjetsRequest): Promise<BulkCreateMecProjetsResponse> {
    return this.mecService.createBulk(request.projets);
  }

  @TrackApiUsage()
  @Get(":id")
  @ApiOperation({
    summary: "Récupérer un projet MEC par ID",
    description: "Retourne le projet avec ses plans liés, ses IDs externes et sa classification.",
  })
  async findOne(@Param("id") id: string) {
    return this.mecService.findOne(id);
  }

  @TrackApiUsage()
  @Patch(":id")
  @ApiOperation({
    summary: "Mettre à jour partiellement un projet MEC",
    description: "Met à jour les champs fournis sans écraser les autres. Utilisé pour le backfill CRTE.",
  })
  async update(
    @Param("id") id: string,
    @Body() request: Partial<CreateMecProjetRequest>,
  ): Promise<CreateMecProjetResponse> {
    return this.mecService.update(id, request);
  }
}
