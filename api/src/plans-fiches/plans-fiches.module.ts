import { Module } from "@nestjs/common";
import { PlansFichesController } from "./plans-fiches.controller";
import { GetPlansService } from "./services/get-plans.service";
import { GetFichesService } from "./services/get-fiches.service";

@Module({
  controllers: [PlansFichesController],
  providers: [GetPlansService, GetFichesService],
  exports: [GetPlansService, GetFichesService],
})
export class PlansFichesModule {}
