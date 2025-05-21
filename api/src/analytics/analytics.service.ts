import { Injectable } from "@nestjs/common";
import { TrackingEvent } from "@/analytics/type";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AnalyticsService {
  constructor(private configService: ConfigService) {}

  async trackEvent(eventData: TrackingEvent) {
    const matomoUrl = this.configService.getOrThrow<string>("MATOMO_URL");
    const siteId = this.configService.getOrThrow<string>("SITE_ID");

    // todo understand the params
    // and add the host / value and other missing fields from the front end

    // api reference : https://developer.matomo.org/api-reference/tracking-api
    // as per doc, all parameters values that are strings (such as 'url', 'action_name', etc.) must be URL encoded.
    const params = new URLSearchParams({
      idsite: siteId,
      rec: "1",
      apiv: "1",
      // todo remove suffixe server side once implementation has been tested
      e_c: `${eventData.category}-server-side`,
      e_a: `${eventData.action}-server-side`,
      e_n: `${eventData.name}-server-side`,
      e_v: eventData.value,
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

    return response;
  }
}
