import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "@database/database.module";
import { LoggerModule } from "@/logging/logger.module";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerGuardProvider } from "./security/throttler.provider";
import { throttlerConfig } from "./security/throttler.config";
import { ServicesModule } from "./services/services.module";
import { SentryModule } from "@sentry/nestjs/setup";
import { CorsMiddleware } from "./middleware/cors.middleware";
import { GeoModule } from "@/geo/geo.module";
import { ProjetsModule } from "@projets/projets.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SentryModule.forRoot(),
    ThrottlerModule.forRoot(throttlerConfig),
    DatabaseModule,
    ProjetsModule,
    ServicesModule,
    LoggerModule,
    GeoModule,
  ],
  providers: [AppService, ThrottlerGuardProvider, RequestLoggingInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware).forRoutes("*");
  }
}
