import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { LesCommuns } from "./LesCommuns.tsx";

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
      http.get("https://les-communs-transition-ecologique-api-prod.osc-fr1.scalingo.io/services/project/123", () => {
        return HttpResponse.json(getMockedServices("prod"));
      }),
    );

    render(<LesCommuns projectId="123" />);

    await screen.findByText("Service 1 prod");
    await screen.findByText("Service 2 prod");

    expect(screen.getByText("Description for service 1")).toBeInTheDocument();
    expect(screen.getByText("Description for service 2")).toBeInTheDocument();
  });

  it("targets staging api when isStagingEnv is provided", async () => {
    server.use(
      http.get("https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/services/project/123", () => {
        return HttpResponse.json(getMockedServices("staging"));
      }),
    );

    render(<LesCommuns projectId="123" isStagingEnv />);

    await screen.findByText("Service 1 staging");
    await screen.findByText("Service 2 staging");

    expect(screen.getByText("Description for service 1")).toBeInTheDocument();
    expect(screen.getByText("Description for service 2")).toBeInTheDocument();
  });
});
