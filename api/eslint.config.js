const { resolve } = require("path");
const tseslint = require("typescript-eslint");
const baseConfig = require("../eslint.base.cjs");

module.exports = tseslint.config(
  ...baseConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: [resolve(__dirname, "./tsconfig.json")],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
    ignores: ["dist/", "node_modules/", "coverage/", "generated-types/"],
  },
  {
    files: ["**/*.spec.ts", "**/*.e2e-spec.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
