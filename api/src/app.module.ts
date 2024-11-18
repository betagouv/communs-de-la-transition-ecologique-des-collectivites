import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ProjectsModule } from "./projects/projects.module";
import { ConfigModule } from "@nestjs/config";
import { ApiKeyGuardProvider } from "./auth/api-key-guard";
import { DatabaseService } from "./database/database.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService, ApiKeyGuardProvider, DatabaseService],
})
export class AppModule {}
