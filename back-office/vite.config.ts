import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * L'API n'active PAS le CORS. Plutôt que de l'ouvrir pour ce back-office — qui est encore un
 * test, et dont on veut pouvoir se débarrasser sans rien toucher côté API — on passe par le
 * proxy du serveur de dev : le navigateur ne voit qu'une seule origine, il n'y a donc pas de
 * requête cross-origin à autoriser.
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
