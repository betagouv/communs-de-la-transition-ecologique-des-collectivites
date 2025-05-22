import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TrackEventRequest } from "@/analytics/analytics.dto";

@Injectable()
export class AnalyticsService {
  constructor(private configService: ConfigService) {}

  async trackEvent(eventData: TrackEventRequest) {
    const matomoUrl = this.configService.getOrThrow<string>("MATOMO_URL");
    const siteId = this.configService.getOrThrow<string>("SITE_ID");

    // api reference : https://developer.matomo.org/api-reference/tracking-api
    // as per doc, all parameters values that are strings (such as 'url', 'action_name', etc.) must be URL encoded.
    const params = new URLSearchParams({
      idsite: siteId,
      rec: "1",
      apiv: "1",
      e_c: `${eventData.category}`,
      e_a: `${eventData.action}`,
      e_n: `${eventData.name}`,
      ...(eventData.value ? { e_v: eventData.value } : {}),
    });

    const response = await fetch(matomoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Erreur de tracking: ${response.status}`);
    }

    return "tracking successful";
  }
}
