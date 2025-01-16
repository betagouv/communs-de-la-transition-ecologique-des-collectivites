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
  };
};
