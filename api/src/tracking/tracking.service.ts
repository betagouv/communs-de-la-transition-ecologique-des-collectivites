import { Injectable } from "@nestjs/common";
import { TrackingEvent } from "@/tracking/type";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TrackingService {
  constructor(private configService: ConfigService) {}

  async trackEvent(eventData: TrackingEvent) {
    const matomoUrl = this.configService.getOrThrow<string>("MATOMO_URL");
    const siteId = this.configService.getOrThrow<string>("SITE_ID");

    // todo understand the params
    // and add the host / value and other missing fields from the front end

    // api refrence : https://developer.matomo.org/api-reference/tracking-api
    const params = new URLSearchParams({
      idsite: siteId,
      rec: "1",
      apiv: "1",
      e_c: eventData.category,
      e_a: eventData.action,
      e_n: eventData.name,
      // ... autres paramètres nécessaires
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
