// todo those types could be removed once we use the open api definition to create the api client
// didn't do it as the first pass on this page

export interface WidgetUsageData {
  navigationToService: number;
  serviceIframeDisplays: number;
  servicesDisplayedPerProject: number;
  externalLinkClicks: number;
  serviceDetailExpansions: number;
  iframeInteractions: number;
  chartData: ChartDataPoint[];
  hostingPlatforms: string[];
}

export interface ChartDataPoint {
  date: string;
  interactions: number;
}

export interface ApiUsageData {
  projetsCount: number;
  apiCallsCount: number;
  servicesCount: number;
}
