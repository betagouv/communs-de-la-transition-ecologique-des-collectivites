import { E2E_BASE_URL } from "@test/helpers/e2e-port";

/**
 * Incident 25/11/2026: MEC started serving its app on a new domain that was missing from
 * CORS_ALLOWED_DOMAINS. The rejection surfaced as a 500 "Unhandled Exception", which sent
 * everyone looking for a server-side failure. A rejected origin must answer a clean 403.
 * CORS_ALLOWED_DOMAINS is pinned to "https://allowed.e2e.test" in helpers/e2e-env.ts.
 */
describe("CORS on widget routes (e2e)", () => {
  // Valid UUID that matches no project: the CORS check runs before the handler.
  const url = `${E2E_BASE_URL}/services/project/00000000-0000-7000-8000-000000000000?idType=communId`;

  it("answers 403 with the standard error body for an origin outside the allow-list", async () => {
    const res = await fetch(url, { headers: { Origin: "https://not-allowed.e2e.test" } });

    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await res.json()).toMatchObject({
      statusCode: 403,
      message: "https://not-allowed.e2e.test not allowed by CORS",
    });
  });

  it("lets an allowed origin through with the CORS header", async () => {
    const res = await fetch(url, { headers: { Origin: "https://allowed.e2e.test" } });

    expect(res.status).not.toBe(403);
    expect(res.status).toBeLessThan(500);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://allowed.e2e.test");
  });
});
