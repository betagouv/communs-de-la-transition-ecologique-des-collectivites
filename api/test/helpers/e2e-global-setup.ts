import "tsconfig-paths/register";

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { execSync } from "child_process";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { DatabaseService } from "@database/database.service";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";
import { serveRessources } from "@/serve-ressources";

declare global {
  var testApp: INestApplication;

  var testDbService: TestDatabaseService;
}

export default async function globalSetup() {
  const DATABASE_URL = "postgres://postgres:mypassword@localhost:5433/e2e_test_db";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.REDIS_URL = "redis://localhost:6380";
  // La suite e2e enchaîne >50 requêtes/min depuis une seule IP : depuis la correction du
  // throttler (ttl en ms), la limite prod ferait des 429 en cascade dans les tests.
  process.env.THROTTLER_LIMIT = process.env.THROTTLER_LIMIT ?? "10000";

  execSync("npm run db:migrate:drizzle", {
    env: {
      ...process.env,
      DATABASE_URL,
    },
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
  await app.init();
  await app.listen(3000);

  global.testApp = app;
  global.testDbService = moduleFixture.get(TestDatabaseService);
}
