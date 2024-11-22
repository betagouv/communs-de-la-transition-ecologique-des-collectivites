import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { RequestLoggingInterceptor } from "@/logging/request-logging.interceptor";
import { GlobalExceptionFilter } from "@/exceptions/global-exception-filter";
import { CustomLogger } from "@/logging/logger.service";

export function setupApp(app: INestApplication) {
  const logger = app.get(CustomLogger);

  app.useLogger(logger);

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

  // Enable CORS
  app.enableCors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const config = new DocumentBuilder()
    .setTitle("API Documentation")
    .setDescription("API description")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, documentFactory, {
    jsonDocumentUrl: "openapi.json",
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  return app;
}
