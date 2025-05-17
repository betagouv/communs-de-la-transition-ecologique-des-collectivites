export default async function globalTeardown() {
  console.time("e2e-teardown");

  console.log("Closing app and db");
  await global.testDbService.cleanDatabase();
  await global.testApp?.close();
}
