import { Module } from "@nestjs/common";
import { GeoApiService } from "@/geo/geo-api.service";
import { GeoService } from "@/geo/geo-service";

@Module({
  providers: [GeoApiService, GeoService],
  exports: [GeoService],
})
export class GeoModule {}
