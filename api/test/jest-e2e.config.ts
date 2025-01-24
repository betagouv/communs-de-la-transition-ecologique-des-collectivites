import type { Config } from "jest";
import commonConfig from "./jest.common";

const config: Config = {
  ...commonConfig,
  testRegex: ".e2e-spec.ts$",
  roots: ["<rootDir>/test/"],
  globalSetup: "<rootDir>/test/helpers/e2e-global-setup.ts", // Runs once at the start
};

export default config;
