beforeEach(async () => {
  await global.testDbService.cleanDatabase();
});

afterAll(async () => {
  await global.testDbService.cleanDatabase();
  await global.testApp?.close();
});
