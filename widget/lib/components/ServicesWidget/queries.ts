import { paths } from "../../generated-types.ts";
import createFetchClient from "openapi-fetch";
import { getApiUrl } from "../../utils.ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const makeApiClient = (isStagingEnv = false) => {
  const apiUrl = getApiUrl(isStagingEnv);

  return createFetchClient<paths>({
    baseUrl: apiUrl,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// -------------- Services by Projects - GET -------------- //

export const useGetServicesByProjectId = (projectId: string, isStagingEnv = false, debug = false) => {
  return useQuery({
    queryKey: ["project-services", projectId],
    queryFn: () => fetchServicesByProjectId(projectId, isStagingEnv, debug),
  });
};

const fetchServicesByProjectId = async (projectId: string, isStagingEnv: boolean, debug: boolean) => {
  const apiClient = makeApiClient(isStagingEnv);
  const { data, error } = await apiClient.GET(`/services/project/{id}`, {
    params: {
      query: { debug },
      path: { id: projectId },
    },
  });

  // needed to comply to react-query error pattern
  // https://tanstack.com/query/latest/docs/framework/react/guides/query-functions?from=reactQueryV3#usage-with-fetch-and-other-clients-that-do-not-throw-by-default
  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// -------------- Project extra fields - GET -------------- //

export const useGetProjectExtraFields = (projectId: string, isStagingEnv = false) => {
  return useQuery({
    queryKey: ["project-extra-fields", projectId],
    queryFn: () => fetchProject(projectId, isStagingEnv),
  });
};

const fetchProject = async (projectId: string, isStagingEnv: boolean) => {
  const apiClient = makeApiClient(isStagingEnv);

  const { data, error } = await apiClient.GET("/projets/{id}/extra-fields", {
    params: {
      path: { id: projectId },
    },
  });

  // needed to comply to react-query error pattern
  // https://tanstack.com/query/latest/docs/framework/react/guides/query-functions?from=reactQueryV3#usage-with-fetch-and-other-clients-that-do-not-throw-by-default
  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// -------------- Project extra fields - POST -------------- //

export const usePostExtraFields = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postExtraFielsPayload,
      isStagingEnv,
    }: {
      postExtraFielsPayload: PostExtraFields;
      isStagingEnv: boolean;
    }) => postExtraFields(postExtraFielsPayload, isStagingEnv),
    onSuccess: async (_, { postExtraFielsPayload }) => {
      await queryClient.invalidateQueries({
        queryKey: ["project-extra-fields", postExtraFielsPayload.projectId],
      });
    },
  });
};

interface PostExtraFields {
  projectId: string;
  fieldName: string;
  fieldValue: string;
}

const postExtraFields = async ({ projectId, fieldName, fieldValue }: PostExtraFields, isStagingEnv = false) => {
  const apiClient = makeApiClient(isStagingEnv);

  const { data, error } = await apiClient.POST("/projets/{id}/extra-fields", {
    body: { extraFields: [{ name: fieldName, value: fieldValue }] },
    params: {
      path: { id: projectId },
    },
  });

  // needed to comply to react-query error pattern
  // https://tanstack.com/query/latest/docs/framework/react/guides/query-functions?from=reactQueryV3#usage-with-fetch-and-other-clients-that-do-not-throw-by-default
  if (error) {
    throw new Error(error.message);
  }

  return data;
};
