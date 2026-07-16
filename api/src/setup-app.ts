import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { GlobalExceptionFilter } from "@/exceptions/global-exception-filter";
import { CustomLogger } from "@/logging/logger.service";
import { MatomoService } from "@/matomo";
import { json, type NextFunction, type Request, type Response } from "express";
import { ProjetsModule } from "@projets/projets.module";
import { ServicesModule } from "./services/services.module";
import { ProjetQualificationModule } from "@/projet-qualification/projet-qualification.module";
import { ClassificationModule } from "@/projet-qualification/classification/classification.module";
import { AidesModule } from "@/aides/aides.module";
import { FichesActionModule } from "@/fiches-action/fiches-action.module";
import { AnalyticsModule } from "@/analytics/analytics.module";
import { MecModule } from "@/mec/mec.module";
import { DecisionsModule } from "@/decisions/decisions.module";
import { TerritoiresModule } from "@/territoires/territoires.module";
import { QuestionnairesModule } from "@/questionnaires/questionnaires.module";
import { RecommandationsModule } from "@/recommandations/recommandations.module";
import { ServicesNumeriquesModule } from "@/services-numeriques/services-numeriques.module";

export function setupApp(app: INestApplication) {
  const logger = app.get(CustomLogger);

  app.useLogger(logger);

  // Les endpoints « bulk » reçoivent d'énormes corps (80k+ projets du CRTE de MEC) ; tout le reste
  // est plafonné bas pour se protéger.
  //
  // ON DÉCIDE SUR LE SUFFIXE DU CHEMIN, pas sur un préfixe fixe. Le premier essai posait
  // l'override sur `/projets/bulk` — mais Express matche `app.use(chemin, …)` par PRÉFIXE, et le
  // bulk de MEC vit à `/mec/v1/projets/bulk`. Ce chemin ne matchait donc pas, retombait sur les
  // 100 Ko, et tout import MEC réel partait en 500 (PayloadTooLargeError). Vu en prod.
  //
  // `endsWith` couvre les DEUX bulk existants (public et MEC) et tout futur `.../projets/bulk`,
  // sans qu'on ait à réénumérer les chemins — c'est exactement ce que l'ancien code oubliait.
  const corpsVolumineux = json({ limit: "50mb" });
  const corpsStandard = json({ limit: "100kb" });
  app.use((req: Request, res: Response, next: NextFunction) =>
    (req.path.endsWith("/projets/bulk") ? corpsVolumineux : corpsStandard)(req, res, next),
  );

  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  const loggingInterceptor = app.get(RequestLoggingInterceptor);
  app.useGlobalInterceptors(loggingInterceptor);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupProjetsDoc(app);

  return app;
}

function setupProjetsDoc(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("API Projets Collectivités")
    .setDescription("API de partage de projets de transition écologique entre plateformes partenaires.")
    .setVersion("1.2")
    .addBearerAuth()
    .build();

  // Get Matomo service for analytics injection into Swagger UI
  const matomoService = app.get(MatomoService);

  const documentFactory = () =>
    SwaggerModule.createDocument(app, config, {
      include: [
        ProjetsModule,
        ServicesModule,
        ProjetQualificationModule,
        ClassificationModule,
        AidesModule,
        FichesActionModule,
        AnalyticsModule,
        MecModule,
        DecisionsModule,
        TerritoiresModule,
        QuestionnairesModule,
        RecommandationsModule,
        ServicesNumeriquesModule,
      ],
    });
  SwaggerModule.setup("api/projets", app, documentFactory, {
    jsonDocumentUrl: "api/projets/openapi.json",
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: "API Projets Collectivités - Documentation",
    // Inject Matomo analytics script into Swagger UI
    customJsStr: matomoService.isTrackingEnabled() ? [matomoService.getInlineScript()] : undefined,
  });
}
