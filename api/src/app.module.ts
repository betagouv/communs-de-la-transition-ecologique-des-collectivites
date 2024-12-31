import { Module } from "@nestjs/common";
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
import { ServicesModule } from "./services/services.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot(throttlerConfig),
    DatabaseModule,
    ProjectsModule,
    ServicesModule,
    LoggerModule,
  ],
  providers: [AppService, ApiKeyGuardProvider, ThrottlerGuardProvider, RequestLoggingInterceptor],
})
export class AppModule {}
