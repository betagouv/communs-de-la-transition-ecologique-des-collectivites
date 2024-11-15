import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ProjectsModule } from "./projects/projects.module";
import { ConfigModule } from "@nestjs/config";
import { ApiKeyGuardProvider } from "./auth/api-key-guard";
import { DatabaseModule } from "./database/database.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ProjectsModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService, ApiKeyGuardProvider],
})
export class AppModule {}
