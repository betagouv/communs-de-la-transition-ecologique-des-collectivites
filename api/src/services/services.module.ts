import { Module } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesController } from "./services.controller";
import { ServicesContextService } from "./services-context.service";
import { CompetencesService } from "@projects/services/competences/competences.service";

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, ServicesContextService, CompetencesService],
})
export class ServicesModule {}
