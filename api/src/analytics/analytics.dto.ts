import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class TrackEventRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  action!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ required: false, type: String })
  @IsString()
  @IsOptional()
  value?: string;
}

export enum MatomoPeriod {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year",
  RANGE = "range",
}

export class GetWidgetUsageDataQuery {
  @ApiProperty({ enum: MatomoPeriod, default: MatomoPeriod.MONTH })
  @IsEnum(MatomoPeriod)
  @IsNotEmpty()
  period!: MatomoPeriod;

  @ApiProperty({ required: false, default: "last6" })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hostingPlatform?: string;
}

export class MatomoEventData {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  nb_events!: number;

  @ApiProperty()
  Events_EventCategory!: string;

  @ApiProperty()
  Events_EventAction!: string;

  @ApiProperty({ required: false })
  nb_events_with_value?: number;

  @ApiProperty({ required: false })
  sum_event_value?: number;

  @ApiProperty({ required: false })
  min_event_value?: number;

  @ApiProperty({ required: false })
  max_event_value?: number;

  @ApiProperty({ required: false })
  avg_event_value?: number;
}

export class MatomoApiResponse {
  [key: string]: MatomoEventData[];
}

export class ChartDataPoint {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  interactions!: number;
}

export class DashboardData {
  @ApiProperty()
  navigationToService!: number;

  @ApiProperty()
  serviceIframeDisplays!: number;

  @ApiProperty()
  servicesDisplayedPerProject!: number;

  @ApiProperty()
  externalLinkClicks!: number;

  @ApiProperty()
  serviceDetailExpansions!: number;

  @ApiProperty()
  iframeInteractions!: number;

  @ApiProperty({ type: [ChartDataPoint] })
  chartData!: ChartDataPoint[];

  @ApiProperty()
  hostingPlatforms!: string[];
}

export class GetGlobalStatsQuery {
  @ApiProperty({ required: true })
  @IsString()
  startDate!: string;

  @ApiProperty({ required: true })
  @IsString()
  endDate!: string;
}
