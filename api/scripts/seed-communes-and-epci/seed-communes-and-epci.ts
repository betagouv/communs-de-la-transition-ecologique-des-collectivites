import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { GeoService } from "@/geo/geo-service";
import { GeoApiService } from "@/geo/geo-api.service";
import { ConfigModule } from "@nestjs/config";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { formatError } from "@/exceptions/utils";
import { LoggerModule } from "@logging/logger.module";
import { currentEnv } from "@/shared/utils/currentEnv";
import { join } from "path";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: join(__dirname, `../../.env.${currentEnv}`),
    }),
    LoggerModule,
  ],
  providers: [GeoService, GeoApiService, DatabaseService],
})
class SeedModule {}

async function seedCommunesAndEpci() {
  const app = await NestFactory.createApplicationContext(SeedModule);
  const geoService = app.get(GeoService);
  const loggerService = app.get(CustomLogger);

  try {
    loggerService.log("seeding collectivites...");
    await geoService.createAllCollectivites();

    loggerService.log("seeding done...");
  } catch (error) {
    loggerService.error(`Error fetching data:`, formatError(error));
  } finally {
    await app.close();
  }
}

void seedCommunesAndEpci();
