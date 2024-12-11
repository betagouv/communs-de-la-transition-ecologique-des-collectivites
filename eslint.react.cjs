const tseslint = require("typescript-eslint");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const reactRefreshPlugin = require("eslint-plugin-react-refresh");
const baseConfig = require("./eslint.base.cjs");
const react = require("eslint-plugin-react");

module.exports = tseslint.config(...baseConfig, {
  files: ["**/*.{ts,tsx}"],
  plugins: {
    "react-hooks": reactHooksPlugin,
    "react-refresh": reactRefreshPlugin,
    react,
  },
  settings: {
    react: { version: "18.2.0" },
  },
  rules: {
    ...react.configs.recommended.rules,
    ...react.configs["jsx-runtime"].rules,
    ...reactHooksPlugin.configs.recommended.rules,
  },
});
