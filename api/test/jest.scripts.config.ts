import type { Config } from "jest";
import commonConfig from "./jest.common";

const config: Config = {
  ...commonConfig,
  testRegex: ".spec.ts$",
  roots: ["<rootDir>/scripts/"],
};

export default config;
