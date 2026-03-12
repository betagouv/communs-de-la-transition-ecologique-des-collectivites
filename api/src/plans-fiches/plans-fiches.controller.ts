import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";
import { Public } from "@/auth/public.decorator";
import { TrackApiUsage } from "@/shared/decorator/track-api-usage.decorator";
import { GetPlansService } from "./services/get-plans.service";
import { GetFichesService } from "./services/get-fiches.service";
import { PlanTransitionResponse, PlanTransitionDetailResponse } from "./dto/plan-transition.dto";
import { FicheActionResponse, FicheActionDetailResponse } from "./dto/fiche-action.dto";

@ApiTags("Plans & Fiches Action (v2)")
@ApiBearerAuth()
@Controller("v2")
export class PlansFichesController {
  constructor(
    private readonly plansService: GetPlansService,
    private readonly fichesService: GetFichesService,
  ) {}

  // --- Plans de transition ---

  @Public()
  @Get("plans-transition")
  @TrackApiUsage()
  @ApiOperation({ summary: "List plans de transition (PCAET)" })
  @ApiQuery({ name: "siren", required: false, description: "Filter by SIREN of responsible collectivité" })
  @ApiQuery({ name: "type", required: false, description: "Filter by plan type (e.g. PCAET)" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiEndpointResponses({ successStatus: 200, response: PlanTransitionResponse, isArray: true })
  async findAllPlans(
    @Query("siren") siren?: string,
    @Query("type") type?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.plansService.findAll({
      siren,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @Get("plans-transition/:id")
  @TrackApiUsage()
  @ApiOperation({ summary: "Get a plan de transition with its fiches action" })
  @ApiParam({ name: "id", type: String, description: "Plan UUID" })
  @ApiEndpointResponses({ successStatus: 200, response: PlanTransitionDetailResponse })
  async findOnePlan(@Param("id", ParseUUIDPipe) id: string): Promise<PlanTransitionDetailResponse> {
    return this.plansService.findOne(id);
  }

  // --- Fiches action ---

  @Public()
  @Get("fiches-action")
  @TrackApiUsage()
  @ApiOperation({ summary: "List fiches action" })
  @ApiQuery({ name: "planId", required: false, description: "Filter by plan de transition UUID" })
  @ApiQuery({ name: "siren", required: false, description: "Filter by SIREN of responsible collectivité" })
  @ApiQuery({ name: "search", required: false, description: "Search by title (case-insensitive)" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "Page number (default: 1)" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Items per page (default: 20, max: 100)" })
  @ApiEndpointResponses({ successStatus: 200, response: FicheActionResponse, isArray: true })
  async findAllFiches(
    @Query("planId") planId?: string,
    @Query("siren") siren?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.fichesService.findAll({
      planId,
      siren,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Public()
  @Get("fiches-action/:id")
  @TrackApiUsage()
  @ApiOperation({ summary: "Get a fiche action with its linked plans" })
  @ApiParam({ name: "id", type: String, description: "Fiche action UUID" })
  @ApiEndpointResponses({ successStatus: 200, response: FicheActionDetailResponse })
  async findOneFiche(@Param("id", ParseUUIDPipe) id: string): Promise<FicheActionDetailResponse> {
    return this.fichesService.findOne(id);
  }
}
