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

    it("should rewrite absolute paths in proxied HTML", async () => {
      const response = await fetch(`${baseUrl}/ressources/cartographie`);
      const html = await response.text();

      // Verify no raw absolute paths remain in HTML attributes (they should be rewritten)
      expect(html).not.toMatch(/(src|href|data-src)="\/(?!ressources\/cartographie\/)[^"]+"/);

      // Verify rewritten paths exist for assets
      expect(html).toContain('="/ressources/cartographie/');

      // Verify external URLs and protocol-relative URLs are NOT rewritten
      expect(html).not.toMatch(/="\/ressources\/cartographie\/https?:/);
      expect(html).not.toMatch(/="\/ressources\/cartographie\/\//);
    });

    it("should rewrite absolute paths in proxied JavaScript files", async () => {
      // First, get the HTML to find a JS file path
      const htmlResponse = await fetch(`${baseUrl}/ressources/cartographie`);
      const html = await htmlResponse.text();

      // Extract a JS file path from the HTML
      const jsMatch = /src="(\/ressources\/cartographie\/assets\/[^"]+\.js)"/.exec(html);
      if (!jsMatch) {
        console.log("Skipping JS rewrite test - no JS file found in HTML");
        return;
      }

      // Fetch the JS file through the proxy
      const jsResponse = await fetch(`${baseUrl}${jsMatch[1]}`);
      expect(jsResponse.status).toBe(200);

      const js = await jsResponse.text();

      // Verify that absolute paths in the JS are rewritten
      // Should not contain raw "/something" paths (except protocol-relative "//")
      const rawPathMatches = js.match(/"\/(?!\/|ressources\/cartographie\/|http)[^"]+"/g) ?? [];
      expect(rawPathMatches).toEqual([]);
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

  describe("GET /ressources/analyses-convergence", () => {
    it("should proxy requests to the analyses-convergence service", async () => {
      const response = await fetch(`${baseUrl}/ressources/analyses-convergence`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      expect(html.toLowerCase()).toContain("<!doctype html>");
    });

    it("should rewrite absolute paths in proxied HTML", async () => {
      const response = await fetch(`${baseUrl}/ressources/analyses-convergence`);
      const html = await response.text();

      // Verify no raw absolute paths remain in HTML attributes (they should be rewritten)
      expect(html).not.toMatch(/(src|href|data-src)="\/(?!ressources\/analyses-convergence\/)[^"]+"/);

      // Verify rewritten paths exist for navigation links
      expect(html).toContain('="/ressources/analyses-convergence/');

      // Verify external URLs and protocol-relative URLs are NOT rewritten
      expect(html).not.toMatch(/="\/ressources\/analyses-convergence\/https?:/);
      expect(html).not.toMatch(/="\/ressources\/analyses-convergence\/\//);
    });

    it("should serve subpages through the proxy", async () => {
      const response = await fetch(`${baseUrl}/ressources/analyses-convergence/analyse-projets/analyse`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("should inject Matomo script if MATOMO_RESSOURCES_SITE_ID is configured", async () => {
      if (!process.env.MATOMO_RESSOURCES_SITE_ID) {
        console.log("Skipping Matomo injection test - MATOMO_RESSOURCES_SITE_ID not configured");
        return;
      }

      const response = await fetch(`${baseUrl}/ressources/analyses-convergence`);
      const html = await response.text();

      expect(html).toContain("<!-- Matomo Analytics -->");
      expect(html).toContain(process.env.MATOMO_RESSOURCES_SITE_ID);
    });
  });
});
