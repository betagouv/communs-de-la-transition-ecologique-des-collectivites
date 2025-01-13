import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { LesCommuns, getApiUrl } from "./LesCommuns.tsx";

const getMockedServices = (env: "prod" | "staging") => [
  {
    id: "1",
    name: `Service 1 ${env}`,
    description: "Description for service 1",
  },
  {
    id: "2",
    name: `Service 2 ${env}`,
    description: "Description for service 2",
  },
];

const server = setupServer();

// Setup & teardown
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("LesCommuns", () => {
  it("displays services when data is loaded", async () => {
    server.use(
      http.get("http://localhost:3000/services/project/123", () => {
        return HttpResponse.json(getMockedServices("prod"));
      })
    );

    render(<LesCommuns projectId="123" />);

    await screen.findByText("Service 1 prod");
    await screen.findByText("Service 2 prod");

    expect(screen.getByText("Description for service 1")).toBeInTheDocument();
    expect(screen.getByText("Description for service 2")).toBeInTheDocument();
  });
});

describe("getApiUrl", () => {
  it("returns localhost URL in dev mode", () => {
    expect(getApiUrl(false, true)).toBe("http://localhost:3000");
  });

  it("returns prod URL in prod mode", () => {
    expect(getApiUrl(false, false)).toBe("https://les-communs-transition-ecologique-api-prod.osc-fr1.scalingo.io");
  });

  it("returns staging URL when isStaging is true in prod mode", () => {
    expect(getApiUrl(true, false)).toBe("https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io");
  });
});
