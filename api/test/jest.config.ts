import type { Config } from "jest";
import commonConfig from "./jest.common";

const config: Config = {
  ...commonConfig,
  testRegex: ".*\\.spec\\.ts$",
  roots: ["<rootDir>/src/"],
  globalSetup: "<rootDir>/test/helpers/unit-test-global-setup.ts",
  globalTeardown: "<rootDir>/test/helpers/unit-test-global-teardown.ts",
};

export default config;
