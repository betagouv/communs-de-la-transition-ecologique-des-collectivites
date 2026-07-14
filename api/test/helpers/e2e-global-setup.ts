import "tsconfig-paths/register";
import "./e2e-env";

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { execSync } from "child_process";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { DatabaseService } from "@database/database.service";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";
import { serveRessources } from "@/serve-ressources";
import { serveLogos } from "@/serve-logos";
import { installUncaughtAssertGuard } from "@test/helpers/e2e-uncaught-guard";
import { E2E_PORT } from "@test/helpers/e2e-port";

declare global {
  var testApp: INestApplication;

  var testDbService: TestDatabaseService;
}

export default async function globalSetup() {
  // L'app (workers BullMQ → Anthropic via undici) tourne dans ce processus.
  // Empêche une AssertionError node:assert de fond de faire échouer un test
  // sans rapport. À installer avant le boot de l'app. Voir e2e-uncaught-guard.ts.
  installUncaughtAssertGuard();

  const DATABASE_URL = "postgres://postgres:mypassword@localhost:5433/e2e_test_db";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.REDIS_URL = "redis://localhost:6380";

  execSync("npm run db:migrate:drizzle", {
    env: {
      ...process.env,
      DATABASE_URL,
    },
  });

  // Les questionnaires vivent désormais en BASE, éditables depuis le back-office. Ils sont amorcés
  // ici depuis content/, comme ils le seront en production (`pnpm seed:questionnaires`).
  //
  // `cleanDatabase()` ne les tronque PAS : c'est une donnée de RÉFÉRENCE, au même titre que le
  // catalogue. Les vider entre chaque test rendrait le questionnaire absent, et chaque suite
  // devrait le réamorcer — un rite dont on finirait par oublier la raison.
  execSync("npm run seed:questionnaires", {
    env: {
      ...process.env,
      DATABASE_URL,
    },
    stdio: "ignore",
  });

  // 2. Setup NestJS App
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [TestDatabaseService],
  })
    .overrideProvider(DatabaseService)
    .useClass(TestDatabaseService)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();

  setupApp(app);
  serveRessources(app);
  serveLogos(app);
  await app.init();
  await app.listen(E2E_PORT);

  global.testApp = app;
  global.testDbService = moduleFixture.get(TestDatabaseService);
}
