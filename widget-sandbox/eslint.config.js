import tseslint from "typescript-eslint";
import reactConfig from "../eslint.react.cjs";

export default tseslint.config(...reactConfig, {
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.vite.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  // Override to exclude Yalc files from ESLint parsing
  ignores: [".yalc/**/*", "node_modules/**/*", "dist/**/*"],
});
