import type { Config } from "jest";
import commonConfig from "./jest.common";

const config: Config = {
  ...commonConfig,
  testRegex: ".*referentiel\\.spec\\.ts$",
  roots: ["<rootDir>/src/"],
  globalSetup: "<rootDir>/test/helpers/referentiel-test-setup.ts",
  globalTeardown: "<rootDir>/test/helpers/referentiel-test-teardown.ts",
};

export default config;
