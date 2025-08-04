import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnalyticsService } from "@/analytics/analytics.service";
import { ApiUsageService } from "@/analytics/api-usage.service";
import {
  DashboardData,
  GetGlobalStatsQuery,
  GetWidgetUsageDataQuery,
  GlobalStatsResponse,
  TrackEventRequest,
} from "@/analytics/analytics.dto";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";

@ApiTags("Analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly apiUsageService: ApiUsageService,
  ) {}

  @Post("trackEvent")
  @ApiEndpointResponses({
    successStatus: 201,
    response: String,
    description: "tracking event sent successfully",
  })
  trackEvent(@Body() trackEventDto: TrackEventRequest) {
    return this.analyticsService.trackEvent(trackEventDto);
  }

  @Get("widget-usage")
  @ApiEndpointResponses({
    successStatus: 200,
    response: DashboardData,
    description: "Retrieve dashboard statistics from Matomo",
  })
  getWidgetUsageData(@Query() query: GetWidgetUsageDataQuery) {
    return this.analyticsService.getDashboardData(query);
  }

  // choosen to have 1 controller and 2 services as the controller serve a unique consumer (the stats dashboard)
  // but the logic between the service (matomo and recorded api) might drastically diverge
  @Get("api-usage")
  @ApiEndpointResponses({ successStatus: 200, response: GlobalStatsResponse })
  @ApiOperation({ summary: "Get global API usage statistics" })
  @ApiEndpointResponses({
    successStatus: 200,
    response: Object,
    description: "Global API usage statistics",
  })
  async getGlobalStats(@Query() query: GetGlobalStatsQuery): Promise<GlobalStatsResponse> {
    return this.apiUsageService.getGlobalStats(query);
  }
}
