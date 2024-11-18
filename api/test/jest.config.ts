import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
  setupFiles: ["./test/setup-tests.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@test/(.*)$": "<rootDir>/test/$1",
    "^@logger/(.*)$": "<rootDir>/src/logger/$1",
    "^@database/(.*)$": "<rootDir>/src/database/$1",
    "^@projects/(.*)$": "<rootDir>/src/projects/$1",
  },
  roots: ["<rootDir>/src/"],
};

export default config;
