/**
 * E2E tests for the /ressources endpoints.
 *
 * These tests verify:
 * 1. Static file serving from ressources-pages/dist
 * 2. Proxy middleware for /ressources/cartographie
 * 3. SPA fallback routing
 *
 * Prerequisites:
 * - ressources-pages must be built (pnpm build:ressources-pages)
 * - The cartography service (communs-te.netlify.app) must be accessible
 */

describe("Ressources (e2e)", () => {
  const baseUrl = "http://localhost:3000";

  describe("GET /ressources", () => {
    it("should serve the ressources landing page", async () => {
      const response = await fetch(`${baseUrl}/ressources`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      // Note: Vite outputs lowercase <!doctype html>
      expect(html.toLowerCase()).toContain("<!doctype html>");
      // Verify it's specifically the ressources-pages content
      expect(html).toContain("API Collectivités");
    });

    it("should serve the ressources landing page for SPA routes", async () => {
      const response = await fetch(`${baseUrl}/ressources/some-spa-route`);

      // Should return index.html for SPA fallback (not 404)
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      // Verify SPA fallback serves the same ressources-pages content
      expect(html).toContain("API Collectivités");
    });
  });

  describe("GET /ressources/cartographie", () => {
    it("should proxy requests to the cartography service", async () => {
      const response = await fetch(`${baseUrl}/ressources/cartographie`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      expect(html.toLowerCase()).toContain("<!doctype html>");
    });

    it("should inject Matomo script if MATOMO_RESSOURCES_SITE_ID is configured", async () => {
      // Skip test if Matomo is not configured in test environment
      if (!process.env.MATOMO_RESSOURCES_SITE_ID) {
        console.log("Skipping Matomo injection test - MATOMO_RESSOURCES_SITE_ID not configured");
        return;
      }

      const response = await fetch(`${baseUrl}/ressources/cartographie`);
      const html = await response.text();

      expect(html).toContain("<!-- Matomo Analytics -->");
      expect(html).toContain(process.env.MATOMO_RESSOURCES_SITE_ID);
    });
  });
});
