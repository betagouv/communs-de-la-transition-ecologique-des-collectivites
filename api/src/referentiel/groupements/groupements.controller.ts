import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { GroupementsService } from "./groupements.service";
import { GroupementQueryDto } from "./dto/groupement-query.dto";
import { GroupementResponse, MembreResponse } from "./dto/groupement.response";
import { CompetenceResponse } from "../competences/dto/competence.response";

@Controller("v1/groupements")
@ApiTags("Référentiel - Groupements")
export class GroupementsController {
  constructor(private readonly groupementsService: GroupementsService) {}

  @Get()
  @ApiOperation({ summary: "Rechercher des groupements" })
  @ApiEndpointResponses({ successStatus: 200, response: GroupementResponse, isArray: true })
  search(@Query() query: GroupementQueryDto): Promise<GroupementResponse[]> {
    return this.groupementsService.search(query);
  }

  @Get(":siren")
  @ApiOperation({ summary: "Détail d'un groupement" })
  @ApiParam({ name: "siren", description: "SIREN (9 chiffres)", example: "200065928" })
  @ApiEndpointResponses({ successStatus: 200, response: GroupementResponse })
  findOne(@Param("siren") siren: string): Promise<GroupementResponse> {
    return this.groupementsService.findOne(siren);
  }

  @Get(":siren/membres")
  @ApiOperation({ summary: "Communes membres d'un groupement" })
  @ApiParam({ name: "siren", description: "SIREN (9 chiffres)", example: "200065928" })
  @ApiEndpointResponses({ successStatus: 200, response: MembreResponse, isArray: true })
  getMembres(@Param("siren") siren: string): Promise<MembreResponse[]> {
    return this.groupementsService.getMembres(siren);
  }

  @Get(":siren/competences")
  @ApiOperation({ summary: "Compétences exercées par un groupement" })
  @ApiParam({ name: "siren", description: "SIREN (9 chiffres)", example: "200065928" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceResponse, isArray: true })
  getCompetences(@Param("siren") siren: string): Promise<CompetenceResponse[]> {
    return this.groupementsService.getCompetences(siren);
  }
}
