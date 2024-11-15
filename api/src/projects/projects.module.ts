import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../database/database.module";

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
