import type { paths, components } from "../generated-types";
import createClient from "openapi-fetch";

export const createApiClient = (apiKey: string) => {
  const client = createClient<paths>({
    baseUrl: process.env.API_URL ?? "http://localhost:3000",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  return {
    projects: {
      create: (data: components["schemas"]["CreateProjectRequest"]) => client.POST("/projects", { body: data }),

      getAll: () => client.GET("/projects"),

      getOne: (id: string, email?: string) =>
        client.GET("/projects/{id}", {
          params: {
            path: { id },
            header: { "X-User-Email": email ?? "" },
          },
        }),

      update: (id: string, data: components["schemas"]["UpdateProjectDto"], email?: string) =>
        client.PATCH("/projects/{id}", {
          params: {
            path: { id },
            header: { "X-User-Email": email ?? "" },
          },
          body: data,
        }),

      remove: (id: string, email?: string) =>
        client.DELETE("/projects/{id}", {
          params: {
            path: { id },
            header: { "X-User-Email": email ?? "" },
          },
        }),
    },
    collaborators: {
      create: (projectId: string, data: components["schemas"]["CreateCollaboratorRequest"]) =>
        client.POST("/projects/{id}/update-collaborators", {
          params: { path: { id: projectId } },
          body: data,
        }),
    },
  };
};
