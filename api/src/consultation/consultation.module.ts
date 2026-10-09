import { Module } from "@nestjs/common";
import { DatabaseModule } from "@database/database.module";
import { ConsultationController } from "./consultation.controller";
import { ConsultationService } from "./consultation.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ConsultationController],
  providers: [ConsultationService],
})
export class ConsultationModule {}
