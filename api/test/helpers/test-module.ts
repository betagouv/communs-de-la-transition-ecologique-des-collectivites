import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "@database/database.service";
import { TestDatabaseService } from "./test-database.service";
import { AppModule } from "@/app.module";
import { Provider } from "@nestjs/common";

export async function testModule(additionalProviders: Provider[] = []) {
  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [...additionalProviders],
  })
    .overrideProvider(DatabaseService)
    .useClass(TestDatabaseService)
    .compile();

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
