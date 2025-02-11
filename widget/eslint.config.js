import tseslint from "typescript-eslint";
import reactConfig from "../eslint.react.cjs";

export default tseslint.config(...reactConfig, {
  ignores: [".yalc/**/*", "dist/**/*", "./lib/generated-types"],
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.vite.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
