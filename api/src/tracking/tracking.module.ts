import { Module } from "@nestjs/common";
import { TrackingController } from "@/tracking/tracking.controller";
import { TrackingService } from "@/tracking/tracking.service";

@Module({
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
