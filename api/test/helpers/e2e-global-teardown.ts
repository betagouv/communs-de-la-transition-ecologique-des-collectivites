import dockerCompose from "docker-compose";
import { join } from "path";

export default async function globalTeardown() {
  console.time("e2e-teardown");

  console.log("Closing app and db");
  await global.testDbService.cleanDatabase();
  await global.testApp?.close();

  // Stop docker containers
  await dockerCompose.downAll({
    cwd: join(__dirname),
    log: true,
  });
}
