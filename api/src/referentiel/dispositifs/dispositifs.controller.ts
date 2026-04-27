import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { DispositifsService } from "./dispositifs.service";
import { DispositifQueryDto } from "./dto/dispositif-query.dto";
import { DispositifResponse, DispositifsDataResponse } from "./dto/dispositif.response";

@Controller("referentiel/v1/dispositifs")
@ApiTags("Référentiel - Dispositifs Territoriaux")
export class DispositifsController {
  constructor(private readonly dispositifsService: DispositifsService) {}

  @Get()
  @ApiOperation({ summary: "Liste des dispositifs territoriaux (COT, etc.)" })
  @ApiEndpointResponses({ successStatus: 200, response: DispositifResponse, isArray: true })
  search(@Query() query: DispositifQueryDto): Promise<DispositifResponse[]> {
    return this.dispositifsService.search(query);
  }

  @Get("all")
  @ApiOperation({ summary: "Tous les dispositifs avec stats agrégées" })
  @ApiEndpointResponses({ successStatus: 200, response: DispositifsDataResponse })
  getAll(): Promise<DispositifsDataResponse> {
    return this.dispositifsService.getAll();
  }
}
