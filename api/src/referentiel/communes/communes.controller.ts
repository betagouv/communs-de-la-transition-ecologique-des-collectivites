import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { CommunesService } from "./communes.service";
import { CommuneQueryDto } from "./dto/commune-query.dto";
import { CommuneResponse, CommuneDetailResponse } from "./dto/commune.response";
import { CompetenceAvecGroupementResponse } from "../competences/dto/competence.response";

@Controller("v1/communes")
@ApiTags("Référentiel - Communes")
export class CommunesController {
  constructor(private readonly communesService: CommunesService) {}

  @Get()
  @ApiOperation({ summary: "Rechercher des communes" })
  @ApiEndpointResponses({ successStatus: 200, response: CommuneResponse, isArray: true })
  search(@Query() query: CommuneQueryDto): Promise<CommuneResponse[]> {
    return this.communesService.search(query);
  }

  @Get(":codeInsee")
  @ApiOperation({ summary: "Détail d'une commune avec ses groupements" })
  @ApiParam({ name: "codeInsee", description: "Code INSEE (5 chiffres)", example: "22006" })
  @ApiEndpointResponses({ successStatus: 200, response: CommuneDetailResponse })
  findOne(@Param("codeInsee") codeInsee: string): Promise<CommuneDetailResponse> {
    return this.communesService.findOne(codeInsee);
  }

  @Get(":codeInsee/competences")
  @ApiOperation({ summary: "Compétences exercées sur une commune" })
  @ApiParam({ name: "codeInsee", description: "Code INSEE (5 chiffres)", example: "22006" })
  @ApiEndpointResponses({ successStatus: 200, response: CompetenceAvecGroupementResponse, isArray: true })
  getCompetences(@Param("codeInsee") codeInsee: string): Promise<CompetenceAvecGroupementResponse[]> {
    return this.communesService.getCompetences(codeInsee);
  }
}
