import { StartedTestContainer } from "testcontainers";

declare global {
  var __REDIS_TESTCONTAINER__: StartedTestContainer;
}

export default async function globalTeardown() {
  const redisContainer = global.__REDIS_TESTCONTAINER__;
  if (redisContainer) {
    console.log("🧹 Stopping Redis testcontainer...");
    await redisContainer.stop();
    console.log("✅ Redis container stopped");
  }
}
