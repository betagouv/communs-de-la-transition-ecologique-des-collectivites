import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { GlobalExceptionFilter } from "@/exceptions/global-exception-filter";
import { CustomLogger } from "@/logging/logger.service";
import { MatomoService } from "@/matomo";
import { json } from "express";

export function setupApp(app: INestApplication) {
  const logger = app.get(CustomLogger);

  app.useLogger(logger);

  // could not find a satisfying way to handle this through middleware
  app.use("/projets/bulk", json({ limit: "2mb" }));
  app.use(json({ limit: "100kb" }));

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

  const config = new DocumentBuilder()
    .setTitle("API Documentation")
    .setDescription("API description")
    .setVersion("1.2")
    .addBearerAuth()
    .build();

  // Get Matomo service for analytics injection into Swagger UI
  const matomoService = app.get(MatomoService);

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory, {
    jsonDocumentUrl: "openapi.json",
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: "API Collectivités - Documentation",
    // Inject Matomo analytics script into Swagger UI
    customJsStr: matomoService.isTrackingEnabled() ? [matomoService.getInlineScript()] : undefined,
  });

  return app;
}
