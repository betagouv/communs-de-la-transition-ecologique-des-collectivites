import type { Config } from "jest";

const commonConfig: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  setupFiles: ["./test/setup-tests.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@test/(.*)$": "<rootDir>/test/$1",
    "^@logging/(.*)$": "<rootDir>/src/logging/$1",
    "^@database/(.*)$": "<rootDir>/src/database/$1",
    "^@projects/(.*)$": "<rootDir>/src/projects/$1",
  },
};

export default commonConfig;
