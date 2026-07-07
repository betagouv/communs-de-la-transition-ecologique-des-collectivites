import * as Sentry from "@sentry/nestjs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { setupApp } from "./setup-app";
import { NestExpressApplication } from "@nestjs/platform-express";
import { serveDemoWidget } from "@/serve-demo-widget";
import { serveStatisticsDashboard } from "@/serve-statistics-dashboard";
import { serveRessources } from "@/serve-ressources";
import { setupReferentielDoc } from "@/referentiel/referentiel-doc.setup";
import { setupOpendataDoc } from "@/plans-fiches/opendata-doc.setup";
import { setupDashboardTeDoc } from "@/dashboard-te/dashboard-te-doc.setup";
import { setupSwaggerHub } from "@/swagger-hub";
import { serveLandingPages } from "@/landing/landing-pages";
import { handleFatalError, installUncaughtErrorHandlers } from "@/shared/process/uncaught-error-handlers";

async function bootstrap() {
  // Initialize Sentry - this not following their doc here : https://docs.sentry.io/platforms/javascript/guides/nestjs/
  // as I could net get the DSN env var to be properly initialized before
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.25,
    environment: process.env.SCALINGO_ENV,
  });

  // Neutralise l'AssertionError node:assert de fond d'undici (issue #507) sans
  // crasher le process ; toute autre uncaughtException reste fatale (log + flush
  // Sentry puis exit). À installer après l'init Sentry pour que la remontée
  // fonctionne. On ne touche PAS aux unhandledRejection (couvertes par le mode
  // 'warn' de Sentry, comportement prod inchangé).
  installUncaughtErrorHandlers();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  setupApp(app);
  setupReferentielDoc(app);
  setupOpendataDoc(app);
  setupDashboardTeDoc(app);
  setupSwaggerHub(app);
  serveDemoWidget(app);
  serveStatisticsDashboard(app);
  serveRessources(app);
  serveLandingPages(app);

  await app.listen(process.env.PORT ?? 3000);
}

// Un échec au démarrage ne doit pas laisser un process zombie : on journalise,
// on flushe Sentry, puis on quitte (fail-fast ciblé sur le boot, sans politique
// globale sur les rejections).
bootstrap().catch((error) => {
  void handleFatalError("bootstrap", error);
});
