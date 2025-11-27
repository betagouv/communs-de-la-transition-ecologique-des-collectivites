export default async function globalTeardown() {
  console.time("e2e-teardown");

  console.log("Closing app and db");
  // Close app first - this will trigger OnModuleDestroy which ends the pool
  await global.testApp?.close();
  // Don't call cleanDatabase() here - pool is already ended
  // Tests clean up after themselves with afterEach hooks
}
