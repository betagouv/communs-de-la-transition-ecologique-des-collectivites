import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseService } from "../../src/database/database.service";
import { TestDatabaseService } from "./test-database.service";
import { AppModule } from "../../src/app.module";
import { ProjectsService } from "../../src/projects/projects.service";

export async function testModule(additionalProviders: any[] = []) {
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
  // Get ProjectsService AFTER database is initialized
  const projectsService = module.get<ProjectsService>(ProjectsService);

  return { module, testDbService, projectsService };
}

export async function teardownTestModule(
  testDbService: TestDatabaseService,
  module: TestingModule,
) {
  await testDbService.cleanDatabase();
  await module.close();
}
