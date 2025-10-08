import { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { StartedTestContainer } from "testcontainers";

declare global {
  // eslint-disable-next-line no-var
  var __TESTCONTAINER__: StartedPostgreSqlContainer;
  // eslint-disable-next-line no-var
  var __REDIS_TESTCONTAINER__: StartedTestContainer;
}

export default async function globalTeardown() {
  const container = global.__TESTCONTAINER__;
  const redisContainer = global.__REDIS_TESTCONTAINER__;

  if (redisContainer) {
    console.log("🧹 Stopping Redis testcontainer...");
    await redisContainer.stop();
    console.log("✅ Redis container stopped");
  }

  if (container) {
    console.log("🧹 Stopping PostgreSQL testcontainer...");
    await container.stop();
    console.log("✅ PostgreSQL container stopped");
  }
}
