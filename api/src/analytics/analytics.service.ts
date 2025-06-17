import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ChartDataPoint,
  DashboardData,
  MatomoApiResponse,
  MatomoStatsRequest,
  TrackEventRequest,
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

  async getDashboardData({ period, date, hostingPlatform }: MatomoStatsRequest): Promise<DashboardData> {
    try {
      const events = await this.getEvents(period, date ?? "last6");

      // Initialize statistics
      let navigationToService = 0;
      let serviceIframeDisplays = 0; // This is not used in the current data
      let servicesDisplayedPerProject = 0;
      let externalLinkClicks = 0;
      let serviceDetailExpansions = 0;
      let iframeInteractions = 0;
      const allHostingPlatforms: string[] = [];
      let monthWhichHaveStats = 0;

      const chartData: ChartDataPoint[] = [];

      Object.entries(events).forEach(([month, monthEvents]) => {
        let monthInteractions = 0;

        monthEvents.forEach((event, index) => {
          if (!allHostingPlatforms.includes(event.Events_EventCategory)) {
            allHostingPlatforms.push(event.Events_EventCategory);
          }

          //do not include data not related to the selected hosting platform
          if (hostingPlatform !== "all" && hostingPlatform !== event.Events_EventCategory) {
            return;
          }

          switch (event.Events_EventAction) {
            case "Affichage du service":
              // we only increase one time per month when both platform are computed
              if ((hostingPlatform === "all" && index === 0) || hostingPlatform === event.Events_EventCategory) {
                monthWhichHaveStats++;
              }
              //todo should we do something to display this stat on the statistic page in the future ?
              break;
            case "Nombre de services affichés":
              servicesDisplayedPerProject += event.avg_event_value ?? 0;
              break;
            case "Clic sur le l'url de redirection":
              externalLinkClicks += event.nb_events;
              monthInteractions += event.nb_events;
              navigationToService += event.nb_events;
              break;
            case "Clic sur le expand":
              serviceDetailExpansions += event.nb_events;
              monthInteractions += event.nb_events;
              serviceIframeDisplays += event.nb_events;
              break;
            case "Clic sur le collapse":
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

      const avgServicesDisplayedPerProject = servicesDisplayedPerProject / monthWhichHaveStats;

      return {
        navigationToService,
        serviceIframeDisplays,
        servicesDisplayedPerProject: Number(avgServicesDisplayedPerProject.toFixed(2)),
        externalLinkClicks,
        serviceDetailExpansions,
        iframeInteractions,
        chartData,
        hostingPlatforms: allHostingPlatforms,
      };
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
      throw error;
    }
  }

  private async getEvents(period = "month", date: string): Promise<MatomoApiResponse> {
    return this.makeMatomoApiRequest({
      method: "Events.getAction",
      period,
      date,
      secondaryDimension: "eventCategory",
    });
  }

  private async makeMatomoApiRequest(params: Record<string, string>): Promise<MatomoApiResponse> {
    const siteId = this.configService.getOrThrow<string>("MATOMO_SITE_ID_PROD");
    const apiToken = this.configService.getOrThrow<string>("MATOMO_API_TOKEN");

    const searchParams = new URLSearchParams({
      module: "API",
      format: "JSON",
      idSite: siteId,
      flat: "1",
      token_auth: apiToken,
      ...params,
    });

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
