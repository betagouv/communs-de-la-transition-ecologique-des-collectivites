import { Module } from "@nestjs/common";
import { AnalyticsController } from "@/analytics/analytics.controller";
import { AnalyticsService } from "@/analytics/analytics.service";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
