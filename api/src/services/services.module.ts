import { Module } from "@nestjs/common";
import { ServicesService } from "./services.service";
import { ServicesController } from "./services.controller";
import { ServicesContextService } from "./services-context.service";

@Module({
  controllers: [ServicesController],
  providers: [ServicesService, ServicesContextService],
})
export class ServicesModule {}
