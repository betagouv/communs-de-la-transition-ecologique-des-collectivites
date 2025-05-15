import "tsconfig-paths/register";

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import dockerCompose from "docker-compose";
import { join } from "path";
import { execSync } from "child_process";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { DatabaseService } from "@database/database.service";
import { AppModule } from "@/app.module";
import { setupApp } from "@/setup-app";

declare global {
  // eslint-disable-next-line no-var
  var testApp: INestApplication;
  // eslint-disable-next-line no-var
  var testDbService: TestDatabaseService;
}

export default async function globalSetup() {
  const DATABASE_URL = "postgres://postgres:mypassword@localhost:5433/e2e_test_db";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.QUEUE_REDIS_URL = "redis://localhost:6379";

  await dockerCompose.upAll({
    cwd: join(__dirname),
    log: true,
  });

  await dockerCompose.exec("e2e_test_db", ["sh", "-c", "until pg_isready ; do sleep 1; done"], {
    cwd: join(__dirname),
  });

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
