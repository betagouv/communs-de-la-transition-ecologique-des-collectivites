import type { paths, components } from "../generated-types";
import createClient from "openapi-fetch";

export const createApiClient = (apiKey: string) => {
  const baseUrl = "http://localhost:3000";

  const client = createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  return {
    projects: {
      create: (data: components["schemas"]["CreateProjetRequest"]) => client.POST("/projets", { body: data }),

      createBulk: (data: components["schemas"]["BulkCreateProjetsRequest"]) =>
        client.POST("/projets/bulk", { body: data }),

      getAll: () => client.GET("/projets"),

      getOne: (id: string) =>
        client.GET("/projets/{id}", {
          params: {
            path: { id },
          },
        }),

      update: (id: string, data: components["schemas"]["UpdateProjetDto"]) =>
        client.PATCH("/projets/{id}", {
          params: {
            path: { id },
          },
          body: data,
        }),
    },
    services: {
      create: (data: components["schemas"]["CreateServiceRequest"]) => client.POST("/services", { body: data }),

      createContext: (id: string, data: components["schemas"]["CreateServiceContextRequest"]) =>
        client.POST("/services/contexts/{id}", {
          params: {
            path: { id },
          },
          body: data,
        }),

      getByProjectId: (id: string, debug?: boolean) =>
        client.GET("/services/project/{id}", {
          params: { path: { id }, query: { debug: Boolean(debug) } },
        }),
    },
  };
};
