import dockerCompose from 'docker-compose';
import { join } from 'path';

export const tearDownSetup = async () => {
  await dockerCompose.down({
    cwd: join(__dirname),
    log: true,
  });
};
