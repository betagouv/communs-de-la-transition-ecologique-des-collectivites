import { E2E_BASE_URL } from "@test/helpers/e2e-port";

/**
 * Security regression (YesWeHack #YWH-PGM10356-244): the public, unauthenticated
 * POST/GET /projets/:id/extra-fields routes allowed anyone to inject or read
 * arbitrary metadata on any project (IDOR write at scale). The feature had a
 * single real consumer (the Bénéfriches "surface" widget field, dormant since
 * 04/2026) and was retired. These routes must no longer exist.
 */
describe("Extra-fields routes removed (e2e)", () => {
  const body = JSON.stringify({
    extraFields: [{ name: "ZZZ-should-not-persist", value: "should-404" }],
  });

  it("POST /projets/:id/extra-fields is gone (404), not reachable unauthenticated", async () => {
    const res = await fetch(`${E2E_BASE_URL}/projets/1/extra-fields?idType=tetId`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(res.status).toBe(404);
  });

  it("GET /projets/:id/extra-fields is gone (404)", async () => {
    const res = await fetch(`${E2E_BASE_URL}/projets/1/extra-fields?idType=tetId`);
    expect(res.status).toBe(404);
  });

  it("POST is gone even with a valid partner key (route no longer exists)", async () => {
    const res = await fetch(`${E2E_BASE_URL}/projets/1/extra-fields?idType=tetId`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MEC_API_KEY}`,
      },
      body,
    });
    expect(res.status).toBe(404);
  });
});
