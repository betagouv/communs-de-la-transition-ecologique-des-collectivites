import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DatabaseModule } from "@database/database.module";
import { LoggerModule } from "@/logging/logger.module";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerGuardProvider } from "./security/throttler.provider";
import { throttlerConfig } from "./security/throttler.config";
import { ServicesModule } from "./services/services.module";
import { SentryModule } from "@sentry/nestjs/setup";
import { CorsMiddleware } from "./middleware/cors.middleware";
import { RessourcesProxyMiddleware } from "./middleware/ressources-proxy.middleware";
import { GeoModule } from "@/geo/geo.module";
import { ProjetsModule } from "@projets/projets.module";
import { currentEnv } from "@/shared/utils/currentEnv";
import { BullModule } from "@nestjs/bullmq";
import { ProjetQualificationModule } from "@/projet-qualification/projet-qualification.module";
import { BullBoardModule } from "@bull-board/nestjs";
import basicAuth from "express-basic-auth";
import { ExpressAdapter } from "@bull-board/express";
import { AnalyticsModule } from "@/analytics/analytics.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${currentEnv}`,
      ignoreEnvFile: process.env.NODE_ENV === "production", // In production, environment variables are set by the deployment
    }),
    SentryModule.forRoot(),
    ThrottlerModule.forRoot(throttlerConfig),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>("REDIS_URL");
        const redisConfig = new URL(redisUrl);
        return {
          connection: {
            host: redisConfig.hostname,
            port: parseInt(redisConfig.port),
            password: redisConfig.password,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullBoardModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        return {
          route: "/queues",
          adapter: ExpressAdapter,
          middleware: basicAuth({
            challenge: true,
            users: { admin: config.getOrThrow<string>("QUEUE_BOARD_PWD") },
          }),
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    ProjetsModule,
    ServicesModule,
    LoggerModule,
    GeoModule,
    ProjetQualificationModule,
    AnalyticsModule,
  ],
  providers: [AppService, ThrottlerGuardProvider, RequestLoggingInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware).forRoutes("*");
    // Proxy must be registered separately to handle /ressources/cartographie before static serving
    consumer.apply(RessourcesProxyMiddleware).forRoutes("/ressources/cartographie", "/ressources/cartographie/*");
  }
}
