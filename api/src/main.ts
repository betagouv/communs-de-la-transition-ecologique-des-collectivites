import * as Sentry from "@sentry/nestjs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setupApp } from "./setup-app";
import { NestExpressApplication } from "@nestjs/platform-express";
import { serveDemoWidget } from "@/serve-demo-widget";

async function bootstrap() {
  // Initialize Sentry - this not following their doc here : https://docs.sentry.io/platforms/javascript/guides/nestjs/
  // as I could net get the DSN env var to be properly initialized before
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.25,
    environment: process.env.SCALINGO_ENV,
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  setupApp(app);
  serveDemoWidget(app);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
