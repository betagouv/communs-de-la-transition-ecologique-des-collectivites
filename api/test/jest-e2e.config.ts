import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@test/(.*)$": "<rootDir>/test/$1",
    "^@logger/(.*)$": "<rootDir>/src/logger/$1",
    "^@database/(.*)$": "<rootDir>/src/database/$1",
    "^@projects/(.*)$": "<rootDir>/src/projects/$1",
  },
  roots: ["<rootDir>/test/"],
};

export default config;
