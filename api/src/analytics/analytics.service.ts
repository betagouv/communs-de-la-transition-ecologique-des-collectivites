import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DashboardData,
  MatomoApiResponse,
  MatomoStatsRequest,
  TrackEventRequest,
  ChartDataPoint,
} from "@/analytics/analytics.dto";

const MATOMO_URL = "https://stats.beta.gouv.fr/matomo.php";
const MATOMO_API_URL = "https://stats.beta.gouv.fr/index.php";

@Injectable()
export class AnalyticsService {
  constructor(private configService: ConfigService) {}

  async trackEvent(eventData: TrackEventRequest) {
    const siteId = this.configService.getOrThrow<string>("MATOMO_SITE_ID");

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

    const response = await fetch(MATOMO_URL, {
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

  async getDashboardData(request: MatomoStatsRequest): Promise<DashboardData> {
    try {
      const events = await this.getEvents(request.period, request.date ?? "last6");

      // Initialize statistics
      let navigationToService = 0;
      let serviceIframeDisplays = 0; // This is not used in the current data
      let servicesDisplayedPerProject = 0;
      let externalLinkClicks = 0;
      let serviceDetailExpansions = 0;
      let iframeInteractions = 0;

      // Prepare chart data
      const chartData: ChartDataPoint[] = [];

      console.log("events", events);
      // Process each month's data
      Object.entries(events).forEach(([month, monthEvents]) => {
        let monthInteractions = 0;

        monthEvents.forEach((event) => {
          let eventValue: number;

          switch (event.label) {
            case "Affichage du service":
            case "Affichage du service-server-side":
              break;
            case "Nombre de services affichés":
            case "Nombre de services affichés-server-side":
              eventValue = event.sum_event_value ?? 0;
              servicesDisplayedPerProject += eventValue;
              break;
            case "Clic sur le l'url de redirection":
              externalLinkClicks += event.nb_events;
              monthInteractions += event.nb_events;
              navigationToService += event.nb_events;
              break;
            case "Clic sur le expand":
            case "Clic sur le expand-server-side":
              serviceDetailExpansions += event.nb_events;
              monthInteractions += event.nb_events;
              serviceIframeDisplays += event.nb_events;
              break;
            case "Clic sur le collapse":
            case "Clic sur le collapse-server-side":
              iframeInteractions += event.nb_events;
              monthInteractions += event.nb_events;
              break;
          }
        });

        chartData.push({
          date: month,
          interactions: monthInteractions,
        });
      });

      return {
        navigationToService,
        serviceIframeDisplays,
        servicesDisplayedPerProject,
        externalLinkClicks,
        serviceDetailExpansions,
        iframeInteractions,
        chartData,
      };
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      throw error;
    }
  }

  private async getEvents(period = "month", date = "today"): Promise<MatomoApiResponse> {
    return this.makeMatomoApiRequest({
      method: "Events.getAction",
      period,
      date,
    });
  }

  private async makeMatomoApiRequest(params: Record<string, string>): Promise<MatomoApiResponse> {
    const siteId = this.configService.getOrThrow<string>("MATOMO_SITE_ID_PROD");
    const apiToken = this.configService.getOrThrow<string>("MATOMO_API_TOKEN");

    const searchParams = new URLSearchParams({
      module: "API",
      format: "JSON",
      idSite: siteId,
      token_auth: apiToken,
      ...params,
    });

    console.log("body", searchParams);
    try {
      const response = await fetch(MATOMO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: searchParams.toString(),
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Try to parse the response as JSON
      try {
        const data = JSON.parse(text) as MatomoApiResponse;
        return data;
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        throw new Error("Invalid JSON response from Matomo");
      }
    } catch (error) {
      console.error("Matomo API request failed:", error);
      throw new Error("Impossible de récupérer les données de Matomo");
    }
  }
}
