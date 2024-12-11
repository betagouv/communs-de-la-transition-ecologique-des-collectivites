import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import tseslint from "typescript-eslint";
import baseConfig from "../eslint.base.cjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(...baseConfig, {
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
});
