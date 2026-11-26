import { E2E_BASE_URL } from "@test/helpers/e2e-port";

/**
 * Incident 25/11/2026: MEC started serving its app on a new domain that was missing from the
 * CORS origin allow-list, which broke the services tab of the widget. The allow-list is gone:
 * every route answers to any origin, and never with credentials (no route relies on cookies).
 */
// Valid UUID that matches no project.
const unknownProjectId = "00000000-0000-7000-8000-000000000000";
const origin = "https://any-partner.e2e.test";

const preflight = (path: string, method: string, requestHeaders: string) =>
  fetch(`${E2E_BASE_URL}${path}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": requestHeaders,
    },
  });

describe("CORS (e2e)", () => {
  it.each([
    `/services/project/${unknownProjectId}?idType=communId`,
    `/projets/${unknownProjectId}/public-info?idType=communId`,
  ])("answers the public widget route %s to any origin", async (path) => {
    const res = await fetch(`${E2E_BASE_URL}${path}`, { headers: { Origin: origin } });

    expect(res.status).toBeLessThan(500);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  // The widget sends Content-Type: application/json on its GETs, so browsers preflight them.
  it("accepts the preflight of a public widget route", async () => {
    const res = await preflight(`/services/project/${unknownProjectId}?idType=communId`, "GET", "content-type");

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("accepts the preflight of POST /analytics/trackEvent", async () => {
    const res = await preflight("/analytics/trackEvent", "POST", "content-type");

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  // A third-party site still needs a key it does not have: answering to any origin opens nothing.
  it("answers API-key routes to any origin, without credentials", async () => {
    const res = await fetch(`${E2E_BASE_URL}/projets`, { headers: { Origin: origin } });

    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("allows the Authorization header in the preflight of an API-key route", async () => {
    const res = await preflight("/projets", "POST", "authorization,content-type");

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-headers")).toBe("authorization,content-type");
  });
});
