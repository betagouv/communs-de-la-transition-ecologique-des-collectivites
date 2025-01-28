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
      create: (data: components["schemas"]["CreateProjectRequest"]) => client.POST("/projects", { body: data }),

      createBulk: (data: components["schemas"]["BulkCreateProjectsRequest"]) =>
        client.POST("/projects/bulk", { body: data }),

      getAll: () => client.GET("/projects"),

      getOne: (id: string) =>
        client.GET("/projects/{id}", {
          params: {
            path: { id },
          },
        }),

      update: (id: string, data: components["schemas"]["UpdateProjectDto"]) =>
        client.PATCH("/projects/{id}", {
          params: {
            path: { id },
          },
          body: data,
        }),
    },
    services: {
      create: (data: components["schemas"]["CreateServiceRequest"]) => client.POST("/services", { body: data }),

      createContext: (serviceId: string, data: components["schemas"]["CreateServiceContextRequest"]) =>
        client.POST("/services/{serviceId}/contexts", {
          params: {
            path: { serviceId },
          },
          body: data,
        }),

      getByProjectId: (projectId: string) =>
        client.GET("/services/project/{projectId}", {
          params: { path: { projectId } },
        }),
    },
  };
};
