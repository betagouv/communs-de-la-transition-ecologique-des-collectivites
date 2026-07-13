/**
 * Port d'écoute de l'app bootée par le globalSetup e2e. Configurable pour que la suite
 * puisse cohabiter avec un serveur de dev déjà sur 3000 (E2E_PORT=3001 pnpm test:e2e).
 * Défaut inchangé : 3000.
 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3000);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
