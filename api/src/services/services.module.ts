import { Module } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesController } from "./services.controller";
import { ServiceContextService } from "./service-context.service";
import { CompetencesService } from "@projects/services/competences/competences.service";

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, ServiceContextService, CompetencesService],
})
export class ServicesModule {}
