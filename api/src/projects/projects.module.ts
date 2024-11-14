import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { PrismaService } from "../prisma.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService],
})
export class ProjectsModule {}
