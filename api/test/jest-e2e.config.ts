import type { Config } from "jest";
import commonConfig from "./jest.common";

const config: Config = {
  ...commonConfig,
  testRegex: ".e2e-spec.ts$",
  roots: ["<rootDir>/test/"],
};

export default config;
