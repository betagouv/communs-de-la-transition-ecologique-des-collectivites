const tseslint = require("typescript-eslint");
const reactConfig = require("../eslint.react.cjs");

module.exports = tseslint.config(...reactConfig, {
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.node.json", "./tsconfig.app.json"],
      tsconfigRootDir: __dirname,
    },
  },
});
