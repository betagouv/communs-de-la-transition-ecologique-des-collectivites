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
import { GeoModule } from "@/geo/geo.module";
import { ProjetsModule } from "@projets/projets.module";
import { currentEnv } from "@/shared/utils/currentEnv";
import { BullModule } from "@nestjs/bullmq";
import { ProjetQualificationModule } from "@/projet-qualification/projet-qualification.module";
import { BullBoardModule } from "@bull-board/nestjs";
import basicAuth from "express-basic-auth";
import { ExpressAdapter } from "@bull-board/express";

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
        return {
          connection: {
            host: config.getOrThrow<string>("QUEUE_REDIS_HOST"),
            port: config.getOrThrow<number>("QUEUE_REDIS_PORT"),
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
  ],
  providers: [AppService, ThrottlerGuardProvider, RequestLoggingInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorsMiddleware).forRoutes("*");
  }
}
