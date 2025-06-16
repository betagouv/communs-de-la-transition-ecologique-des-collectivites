import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { AnalyticsService } from "@/analytics/analytics.service";
import { TrackEventRequest, MatomoStatsRequest, DashboardData } from "@/analytics/analytics.dto";
import { ApiEndpointResponses } from "@/shared/decorator/api-response.decorator";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("trackEvent")
  @ApiEndpointResponses({
    successStatus: 201,
    response: String,
    description: "tracking event sent successfully",
  })
  trackEvent(@Body() trackEventDto: TrackEventRequest) {
    return this.analyticsService.trackEvent(trackEventDto);
  }

  @Get("dashboard")
  @ApiEndpointResponses({
    successStatus: 200,
    response: DashboardData,
    description: "Retrieve dashboard statistics from Matomo",
  })
  getDashboardData(@Query() query: MatomoStatsRequest) {
    return this.analyticsService.getDashboardData(query);
  }
}
