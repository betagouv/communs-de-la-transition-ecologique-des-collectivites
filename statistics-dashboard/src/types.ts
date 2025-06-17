export interface DashboardData {
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
