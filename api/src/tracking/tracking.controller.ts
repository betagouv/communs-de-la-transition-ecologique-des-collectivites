import { Body, Controller, Post } from "@nestjs/common";
import { TrackingEvent } from "@/tracking/type";
import { TrackingService } from "@/tracking/tracking.service";

@Controller("analytics")
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post("track")
  async trackEvent(@Body() eventData: TrackingEvent) {
    await this.trackingService.trackEvent(eventData);
  }
}
