import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { GeoService } from "@/geo/geo-service";
import { GeoApiService } from "@/geo/geo-api.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [GeoService, GeoApiService],
})
class SeedModule {}

async function seedCommunesAndEpci() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const geoService = app.get(GeoService);

  try {
    console.log("Fetching communes...");
    await geoService.createAllCollectivites();
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    await app.close();
  }
}

void seedCommunesAndEpci();
