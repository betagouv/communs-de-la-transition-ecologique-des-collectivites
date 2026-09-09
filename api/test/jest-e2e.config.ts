import type { Config } from "jest";
import commonConfig from "./jest.common";

const config: Config = {
  ...commonConfig,
  testRegex: ".e2e-spec.ts$",
  roots: ["<rootDir>/test/"],
  globalSetup: "<rootDir>/test/helpers/e2e-global-setup.ts", // Runs once at the start
  globalTeardown: "<rootDir>/test/helpers/e2e-global-teardown.ts",
  // Chaque test/hook e2e fait de l'I/O réelle (HTTP + DB) ; le défaut Jest de 5 s flanche
  // par intermittence sous charge CI (notamment le cold-start du 1er appel après boot).
  testTimeout: 30000,
};

export default config;
