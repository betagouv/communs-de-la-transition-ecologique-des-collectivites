import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { libInjectCss } from "vite-plugin-lib-inject-css";

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      react: resolve(__dirname, "./node_modules/react"),
      "react-dom": resolve(__dirname, "./node_modules/react-dom"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./lib/test/setup.ts",
    pool: "forks",
  },
  plugins: [
    react(),
    libInjectCss(),
    dts({
      include: ["lib"],
      rollupTypes: true, //merge all declarations into one file
      entryRoot: "lib",
      tsconfigPath: "./tsconfig.app.json",
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "lib/index.ts"),
      name: "LesCommuns",
      formats: ["es"],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@codegouvfr/react-dsfr", "@codegouvfr/react-dsfr/spa"],
    },
  },
});
