import dockerCompose from "docker-compose";
import { join } from "path";

export const e2eTearDownSetup = async () => {
  await dockerCompose.down({
    cwd: join(__dirname),
    log: true,
    commandOptions: ["--remove-orphans", "--volumes"],
  });
};
