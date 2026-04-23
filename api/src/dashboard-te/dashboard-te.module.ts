import { Module } from "@nestjs/common";
import { DashboardTeController } from "./dashboard-te.controller";
import { DashboardTeService } from "./dashboard-te.service";
import { DatabaseModule } from "@database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardTeController],
  providers: [DashboardTeService],
})
export class DashboardTeModule {}
