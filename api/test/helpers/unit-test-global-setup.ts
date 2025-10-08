import "tsconfig-paths/register";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { execSync } from "child_process";

declare global {
  // eslint-disable-next-line no-var
  var __TESTCONTAINER__: StartedPostgreSqlContainer;
  // eslint-disable-next-line no-var
  var __REDIS_TESTCONTAINER__: StartedTestContainer;
}

export default async function globalSetup() {
  console.log("🐳 Starting PostgreSQL testcontainer...");

  // Start PostgreSQL container
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  // Store container in global scope for teardown
  global.__TESTCONTAINER__ = container;

  // Get connection string
  const DATABASE_URL = container.getConnectionUri();
  process.env.DATABASE_URL = DATABASE_URL;

  console.log(`✅ PostgreSQL container started: ${container.getHost()}:${container.getPort()}`);

  // Start Redis container
  console.log("🐳 Starting Redis testcontainer...");
  const redisContainer = await new GenericContainer("redis:7-alpine").withExposedPorts(6379).start();

  // Store Redis container in global scope for teardown
  global.__REDIS_TESTCONTAINER__ = redisContainer;

  // Set Redis URL
  const REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.REDIS_URL = REDIS_URL;

  console.log(`✅ Redis container started: ${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`);

  // Run migrations
  console.log("🔄 Running database migrations...");
  try {
    execSync("pnpm db:migrate:drizzle", {
      env: {
        ...process.env,
        DATABASE_URL,
      },
      stdio: "inherit",
    });
    console.log("✅ Migrations completed");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await container.stop();
    await redisContainer.stop();
    throw error;
  }
}
