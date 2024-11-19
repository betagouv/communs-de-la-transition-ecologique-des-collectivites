import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ProjectsModule } from "@projects/projects.module";
import { ConfigModule } from "@nestjs/config";
import { ApiKeyGuardProvider } from "./auth/api-key-guard";
import { DatabaseModule } from "@database/database.module";
import { LoggerModule } from "@/logging/logger.module";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerGuardProvider } from "./security/throttler.provider";
import { throttlerConfig } from "./security/throttler.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot(throttlerConfig),
    DatabaseModule,
    ProjectsModule,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ApiKeyGuardProvider,
    ThrottlerGuardProvider,
    RequestLoggingInterceptor,
  ],
})
export class AppModule {}
