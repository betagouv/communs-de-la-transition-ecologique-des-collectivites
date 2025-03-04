import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "@database/database.service";
import { TestDatabaseService } from "./test-database.service";
import { AppModule } from "@/app.module";
import { Provider } from "@nestjs/common";

export async function testModule(additionalProviders: Provider[] = []) {
  let testingModule = Test.createTestingModule({
    imports: [AppModule],
    providers: [...additionalProviders],
  })
    .overrideProvider(DatabaseService)
    .useClass(TestDatabaseService);

  // Apply any additional provider overrides
  for (const provider of additionalProviders) {
    if ("provide" in provider && "useValue" in provider) {
      testingModule = testingModule.overrideProvider(provider.provide).useValue(provider.useValue);
    }
  }
  const module = await testingModule.compile();

  // Initialize module first
  await module.init();

  // Get services AFTER module initialization
  const testDbService = module.get<TestDatabaseService>(DatabaseService);

  return { module, testDbService };
}

export async function teardownTestModule(testDbService: TestDatabaseService, module: TestingModule) {
  await testDbService.cleanDatabase();
  await module.close();
}
