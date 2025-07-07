import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useServicesWidgetData } from "./useServicesWidgetData.ts";
import { getApiUrl } from "../../utils.ts";

// Mock des données de test
const createMockServices = (mode: "project" | "context") => [
  {
    id: "1",
    name: `Service Test 1 ${mode}`,
    description: "Description du service 1",
  },
  {
    id: "2",
    name: `Service Test 2 ${mode}`,
    description: "Description du service 2",
  },
];

const mockProjectData = {
  id: "test-project",
  name: "Projet Test",
  collectivites: [
    {
      nom: "Collectivité Test",
      code: "12345",
    },
  ],
};

const mockExtraFields = [
  {
    id: "field1",
    name: "Champ Extra 1",
    value: "Valeur 1",
  },
];

const LOCAL_BASE_URL = "http://localhost:3000";

const handlers = [
  http.get(`${LOCAL_BASE_URL}/services/project/:projectId`, () => {
    return HttpResponse.json(createMockServices("project"));
  }),

  http.get(`${LOCAL_BASE_URL}/services/search/context`, () => {
    return HttpResponse.json(createMockServices("context"));
  }),

  http.get(`${LOCAL_BASE_URL}/projets/:projectId/public-info`, () => {
    return HttpResponse.json(mockProjectData);
  }),

  http.get(`${LOCAL_BASE_URL}/projets/:projectId/extra-fields`, () => {
    return HttpResponse.json(mockExtraFields);
  }),

  http.post(`${LOCAL_BASE_URL}/analytics/trackEvent`, () => {
    return HttpResponse.json({ success: true });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe("useServicesWidgetData", () => {
  it("should fetch data in project mode when projectId is provided", async () => {
    const { result } = renderHook(
      () =>
        useServicesWidgetData({
          projectId: "test-project",
          idType: "communId",
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.services).toBeUndefined();
    expect(result.current.projectCollectivite).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.services).toEqual(createMockServices("project"));
    expect(result.current.projectCollectivite).toEqual(mockProjectData.collectivites[0]);
    expect(result.current.extraFields).toEqual(mockExtraFields);
    expect(result.current.error).toBeNull();
  });

  it("should fetch data in context mode when context is provided", async () => {
    const { result } = renderHook(
      () =>
        useServicesWidgetData({
          context: {
            competences: ["test-competence"],
            leviers: ["test-levier"],
            phases: ["test-phase"],
            regions: ["test-region"],
          },
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.services).toEqual(createMockServices("context"));
    expect(result.current.error).toBeNull();
  });

  it("should handle errors gracefully", async () => {
    server.use(
      http.get(`${getApiUrl(false)}/services/project/:projectId`, () => {
        return HttpResponse.error();
      }),
    );

    const { result } = renderHook(
      () =>
        useServicesWidgetData({
          projectId: "test-project",
          idType: "communId",
          isStagingEnv: false,
          debug: false,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.services).toBeUndefined();
  });

  it("should use fake data when debug mode is enabled", async () => {
    const { result } = renderHook(
      () =>
        useServicesWidgetData({
          projectId: "test-project",
          idType: "communId",
          isStagingEnv: false,
          debug: true,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.services).toEqual(createMockServices("project"));
    expect(result.current.projectCollectivite).toBeDefined();
  });
});
