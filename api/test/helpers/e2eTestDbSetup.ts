import { join } from "path";
import dockerCompose from "docker-compose";
import { execSync } from "child_process";

export const e2eTestDbSetup = async () => {
  console.time("testDbSetup");
  // Set test database URL
  const DATABASE_URL =
    "postgres://postgres:mypassword@localhost:5433/e2e_test_db";
  process.env.DATABASE_URL = DATABASE_URL;

  await dockerCompose.upAll({
    cwd: join(__dirname),
    log: true,
  });

  await dockerCompose.exec(
    "e2e_test_db",
    ["sh", "-c", "until pg_isready ; do sleep 1; done"],
    {
      cwd: join(__dirname),
    },
  );

  execSync("npm run db:migrate:drizzle", {
    env: {
      ...process.env,
      DATABASE_URL,
    },
  });

  // 👍🏼 We're ready
  console.timeEnd("global-setup");
};
