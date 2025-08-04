import { Module } from "@nestjs/common";
import { AnalyticsController } from "@/analytics/analytics.controller";
import { AnalyticsService } from "@/analytics/analytics.service";
import { ApiUsageService } from "@/analytics/api-usage.service";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ApiUsageService],
  exports: [ApiUsageService], // Export for use in interceptor
})
export class AnalyticsModule {}
