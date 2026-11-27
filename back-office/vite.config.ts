import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * En dev, le navigateur n'appelle que le serveur Vite, qui relaie `/api/*` vers l'API
 * (VITE_API_TARGET). Ce back-office est encore un test, dont on veut pouvoir se débarrasser sans
 * rien toucher côté API : il ne demande donc aucun réglage à l'API.
 */
const cible = process.env.VITE_API_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  base: "/back-office/",
  server: {
    proxy: {
      "/api": { target: cible, changeOrigin: true, rewrite: (chemin) => chemin.replace(/^\/api/, "") },
    },
  },
});
