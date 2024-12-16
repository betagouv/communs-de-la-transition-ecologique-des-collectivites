import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { LesCommuns } from "./LesCommuns.tsx";

const mockServices = [
  {
    id: "1",
    name: "Service 1",
    description: "Description for service 1",
  },
  {
    id: "2",
    name: "Service 2",
    description: "Description for service 2",
  },
];

const server = setupServer(
  http.get("http://localhost:3000/services/project/:projectId", () => {
    return HttpResponse.json(mockServices);
  }),
);

// Setup & teardown
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("LesCommuns", () => {
  it("displays services when data is loaded", async () => {
    render(<LesCommuns projectId="123" />);

    await screen.findByText("Service 1");
    await screen.findByText("Service 2");

    expect(screen.getByText("Description for service 1")).toBeInTheDocument();
    expect(screen.getByText("Description for service 2")).toBeInTheDocument();
  });
});
