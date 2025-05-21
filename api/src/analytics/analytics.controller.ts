import { Body, Controller, Post } from "@nestjs/common";
import { AnalyticsService } from "@/analytics/analytics.service";
import { TrackingEvent } from "@/analytics/type";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("trackEvent")
  async trackEvent(@Body() eventData: TrackingEvent) {
    await this.analyticsService.trackEvent(eventData);
  }
}
