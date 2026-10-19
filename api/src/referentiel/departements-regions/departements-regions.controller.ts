import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { DepartementsRegionsService } from "./departements-regions.service";
import { DepartementQueryDto } from "./dto/departement-query.dto";
import { DepartementResponse, RegionDetailResponse, RegionResponse } from "./dto/departement-region.response";

@Controller("referentiel/v1/departements")
@ApiTags("Référentiel - Départements et régions")
export class DepartementsController {
  constructor(private readonly service: DepartementsRegionsService) {}

  @Get()
  @ApiOperation({ summary: "Lister les départements, avec leur région et le SIREN de leur collectivité" })
  @ApiEndpointResponses({ successStatus: 200, response: DepartementResponse, isArray: true })
  findAll(@Query() query: DepartementQueryDto): Promise<DepartementResponse[]> {
    return this.service.departements(query);
  }

  @Get(":code")
  @ApiOperation({ summary: "Détail d'un département" })
  @ApiParam({ name: "code", description: "Code INSEE du département", example: "22" })
  @ApiEndpointResponses({ successStatus: 200, response: DepartementResponse })
  findOne(@Param("code") code: string): Promise<DepartementResponse> {
    return this.service.departement(code);
  }
}

@Controller("referentiel/v1/regions")
@ApiTags("Référentiel - Départements et régions")
export class RegionsController {
  constructor(private readonly service: DepartementsRegionsService) {}

  @Get()
  @ApiOperation({ summary: "Lister les régions, avec le SIREN de leur collectivité" })
  @ApiEndpointResponses({ successStatus: 200, response: RegionResponse, isArray: true })
  findAll(): Promise<RegionResponse[]> {
    return this.service.regions();
  }

  @Get(":code")
  @ApiOperation({ summary: "Détail d'une région avec ses départements" })
  @ApiParam({ name: "code", description: "Code INSEE de la région", example: "53" })
  @ApiEndpointResponses({ successStatus: 200, response: RegionDetailResponse })
  findOne(@Param("code") code: string): Promise<RegionDetailResponse> {
    return this.service.region(code);
  }
}
