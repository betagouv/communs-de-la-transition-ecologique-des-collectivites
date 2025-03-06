import { Module } from "@nestjs/common";
import { GeoApiService } from "@/geo/geo-api.service";
import { GeoService } from "@/geo/geo-service";
import { CustomLogger } from "@logging/logger.service";

@Module({
  providers: [GeoApiService, GeoService, CustomLogger],
  exports: [GeoService],
})
export class GeoModule {}
