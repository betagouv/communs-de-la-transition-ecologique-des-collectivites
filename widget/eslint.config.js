import tseslint from "typescript-eslint";
import reactConfig from "../eslint.react.cjs";

export default tseslint.config(...reactConfig, {
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.node.json", "./tsconfig.app.json"],
      tsconfigRootDir: import.meta.dirname,
    },
  },
});
