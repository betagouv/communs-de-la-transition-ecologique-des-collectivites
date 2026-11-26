import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DatabaseModule } from "@database/database.module";
import { AuthModule } from "@/auth/auth.module";
import { LoggerModule } from "@/logging/logger.module";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerGuardProvider } from "./security/throttler.provider";
import { throttlerConfig } from "./security/throttler.config";
import { ServicesModule } from "./services/services.module";
import { SentryModule } from "@sentry/nestjs/setup";
import cors from "cors";
import { GeoModule } from "@/geo/geo.module";
import { ProjetsModule } from "@projets/projets.module";
import { currentEnv } from "@/shared/utils/currentEnv";
import { BullModule } from "@nestjs/bullmq";
import { ProjetQualificationModule } from "@/projet-qualification/projet-qualification.module";
import { ClassificationModule } from "@/projet-qualification/classification/classification.module";
import { AidesModule } from "@/aides/aides.module";
import { FichesActionModule } from "@/fiches-action/fiches-action.module";
import { BullBoardModule } from "@bull-board/nestjs";
import basicAuth from "express-basic-auth";
import { ExpressAdapter } from "@bull-board/express";
import { AnalyticsModule } from "@/analytics/analytics.module";
import { MatomoModule } from "@/matomo";
import { ReferentielModule } from "@/referentiel/referentiel.module";
import { HealthController } from "@/health/health.controller";
import { PlansFichesModule } from "@/plans-fiches/plans-fiches.module";
import { ProjetsV2Module } from "@/projets-v2/projets-v2.module";
import { BatchClassificationModule } from "@/batch-classification/batch-classification.module";
import { DashboardTeModule } from "@/dashboard-te/dashboard-te.module";
import { MecModule } from "@/mec/mec.module";
import { DecisionsModule } from "@/decisions/decisions.module";
import { TerritoiresModule } from "@/territoires/territoires.module";
import { ConsultationModule } from "@/consultation/consultation.module";
import { QuestionnairesModule } from "@/questionnaires/questionnaires.module";
import { RecommandationsModule } from "@/recommandations/recommandations.module";
import { ServicesNumeriquesModule } from "@/services-numeriques/services-numeriques.module";
import { AdminModule } from "@/admin/admin.module";
import { AjoutsManuelsModule } from "@/ajouts-manuels/ajouts-manuels.module";

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
    AuthModule,
    ProjetsModule,
    ServicesModule,
    LoggerModule,
    GeoModule,
    ProjetQualificationModule,
    ClassificationModule,
    AidesModule,
    FichesActionModule,
    AnalyticsModule,
    MatomoModule,
    ReferentielModule,
    PlansFichesModule,
    ProjetsV2Module,
    BatchClassificationModule,
    DashboardTeModule,
    MecModule,
    DecisionsModule,
    TerritoiresModule,
    ConsultationModule,
    QuestionnairesModule,
    RecommandationsModule,
    ServicesNumeriquesModule,
    AdminModule,
    AjoutsManuelsModule,
  ],
  controllers: [HealthController],
  providers: [AppService, ThrottlerGuardProvider, RequestLoggingInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Every route answers to any origin, without credentials. Keyless routes are readable by
    // anyone anyway, keyed routes need a key a third-party site does not have, and no route
    // relies on cookies: an origin allow-list protected nothing and broke partners whose domain
    // had been forgotten (incident 25/11/2026). Never enable `credentials` with this setup.
    consumer.apply(cors()).forRoutes("*");
  }
}
