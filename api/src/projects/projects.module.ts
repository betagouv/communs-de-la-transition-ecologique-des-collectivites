import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { ConfigModule } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";

@Module({
  imports: [ConfigModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, DatabaseService],
})
export class ProjectsModule {}
