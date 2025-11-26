import "tsconfig-paths/register";

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { execSync } from "child_process";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { DatabaseService } from "@database/database.service";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";

declare global {
  var testApp: INestApplication;

  var testDbService: TestDatabaseService;
}

export default async function globalSetup() {
  const DATABASE_URL = "postgres://postgres:mypassword@localhost:5433/e2e_test_db";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.REDIS_URL = "redis://localhost:6380";

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

  const app = moduleFixture.createNestApplication();

  setupApp(app);
  await app.init();
  await app.listen(3000);

  global.testApp = app;
  global.testDbService = moduleFixture.get(TestDatabaseService);
}
