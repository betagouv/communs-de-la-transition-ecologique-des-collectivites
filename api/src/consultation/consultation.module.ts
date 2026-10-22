import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseModule } from "@database/database.module";
import { ConsultationController } from "./consultation.controller";
import { ConsultationService } from "./consultation.service";
import { ConsultationExportController } from "./export/consultation-export.controller";
import { ConsultationExportService } from "./export/consultation-export.service";
import { EXPORT_STORE } from "./export/export-store";
import { exportStoreFromEnv } from "./export/s3-export-store";

@Module({
  imports: [DatabaseModule],
  controllers: [ConsultationController, ConsultationExportController],
  providers: [
    ConsultationService,
    ConsultationExportService,
    {
      provide: EXPORT_STORE,
      useFactory: (config: ConfigService) => exportStoreFromEnv((key) => config.get<string>(key)),
      inject: [ConfigService],
    },
  ],
})
export class ConsultationModule {}
