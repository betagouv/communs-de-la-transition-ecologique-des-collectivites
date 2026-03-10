import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { RechercheService } from "./recherche.service";
import { RechercheQueryDto } from "./dto/recherche-query.dto";
import { RechercheResponse } from "./dto/recherche.response";

@Controller("v1/recherche")
@ApiTags("Référentiel - Recherche")
export class RechercheController {
  constructor(private readonly rechercheService: RechercheService) {}

  @Get()
  @ApiOperation({ summary: "Recherche transversale (communes + groupements)" })
  @ApiEndpointResponses({ successStatus: 200, response: RechercheResponse })
  search(@Query() query: RechercheQueryDto): Promise<RechercheResponse> {
    return this.rechercheService.search(query);
  }
}
