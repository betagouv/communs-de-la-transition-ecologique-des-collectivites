export interface DashboardData {
  navigationToService: number;
  serviceIframeDisplays: number;
  servicesDisplayedPerProject: number;
  externalLinkClicks: number;
  serviceDetailExpansions: number;
  iframeInteractions: number;
  chartData: ChartDataPoint[];
}

export interface ChartDataPoint {
  date: string;
  interactions: number;
}

export interface MatomoEventData {
  label: string;
  nb_events: number;
  nb_events_with_value?: number;
  sum_event_value?: number;
  min_event_value?: number;
  max_event_value?: number;
  avg_event_value?: number;
}

export interface StatisticCard {
  title: string;
  value: number;
  description?: string;
}
