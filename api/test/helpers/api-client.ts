import type { components, paths } from "../generated-types";
import createClient from "openapi-fetch";
import { IdType } from "@/shared/types";

export const createApiClient = (apiKey?: string) => {
  const baseUrl = "http://localhost:3000";

  const client = createClient<paths>({
    baseUrl,
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
  });

  return {
    projets: {
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

      getPublicInfo: (id: string, idType: IdType) =>
        client.GET("/projets/{id}/public-info", {
          params: {
            path: { id },
            query: { idType },
          },
        }),

      update: (id: string, data: components["schemas"]["UpdateProjetRequest"]) =>
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
          params: {
            path: { id },
            query: {
              debug: Boolean(debug),
              idType: "communId",
            },
          },
        }),

      getByContext: (params: paths["/services/search/context"]["get"]["parameters"]["query"]) =>
        client.GET("/services/search/context", {
          params: {
            query: params,
          },
        }),
    },
    analytics: {
      getGlobalStats: (params?: paths["/analytics/api-usage"]["get"]["parameters"]["query"]) =>
        client.GET("/analytics/api-usage", {
          params: {
            query: params!,
          },
        }),

      getWidgetUsage: (params?: paths["/analytics/widget-usage"]["get"]["parameters"]["query"]) =>
        client.GET("/analytics/widget-usage", {
          params: {
            query: params!,
          },
        }),
    },
  };
};
