import { paths } from "../../generated-types.ts";
import createFetchClient from "openapi-fetch";
import { getApiUrl } from "../../utils.ts";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { IdType, Service, ProjectData, ExtraFields } from "./types.ts";

const makeApiClient = (isStagingEnv = false) => {
  const apiUrl = getApiUrl(isStagingEnv);

  return createFetchClient<paths>({
    baseUrl: apiUrl,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

interface BaseQueryParams {
  projectId: string;
  idType: IdType;
  options: {
    isStagingEnv?: boolean;
    debug?: boolean;
  };
}

// -------------- Services by Projects - GET -------------- //
export const useGetServicesByProjectId = (params: BaseQueryParams): UseQueryResult<Service[]> => {
  return useQuery({
    queryKey: ["project-services", params.projectId],
    queryFn: () => fetchServicesByProjectId(params),
  });
};

const fetchServicesByProjectId = async ({ projectId, idType, options }: BaseQueryParams) => {
  const { isStagingEnv = false, debug = false } = options;
  const apiClient = makeApiClient(isStagingEnv);
  const { data, error } = await apiClient.GET(`/services/project/{id}`, {
    params: {
      query: { debug, idType },
      path: { id: projectId },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// -------------- Project Public Info - GET -------------- //
export const useGetProjectPublicInfo = (params: BaseQueryParams): UseQueryResult<ProjectData> => {
  return useQuery({
    queryKey: ["project-public-info", params.projectId],
    queryFn: () => fetchProjectPublicInfo(params),
    enabled: !params.options.debug,
  });
};

const fetchProjectPublicInfo = async ({ projectId, idType, options }: BaseQueryParams) => {
  const { isStagingEnv = false } = options;
  const apiClient = makeApiClient(isStagingEnv);

  const { data, error } = await apiClient.GET("/projets/{id}/public-info", {
    params: {
      query: { idType },
      path: { id: projectId },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// -------------- Project Extra Fields - GET -------------- //
export const useGetProjectExtraFields = (params: BaseQueryParams): UseQueryResult<ExtraFields> => {
  return useQuery({
    queryKey: ["project-extra-fields", params.projectId],
    queryFn: () => fetchProjectExtraFields(params),
    enabled: !params.options.debug,
  });
};

const fetchProjectExtraFields = async ({ projectId, idType, options }: BaseQueryParams) => {
  const apiClient = makeApiClient(options.isStagingEnv);

  const { data, error } = await apiClient.GET("/projets/{id}/extra-fields", {
    params: {
      query: { idType },
      path: { id: projectId },
    },
  });

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
      idType,
    }: {
      postExtraFielsPayload: PostExtraFields;
      isStagingEnv: boolean;
      idType: IdType;
    }) => postExtraFields(postExtraFielsPayload, idType, isStagingEnv),
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

const postExtraFields = async (
  { projectId, fieldName, fieldValue }: PostExtraFields,
  idType: IdType,
  isStagingEnv = false,
) => {
  const apiClient = makeApiClient(isStagingEnv);

  const { data, error } = await apiClient.POST("/projets/{id}/extra-fields", {
    body: { extraFields: [{ name: fieldName, value: fieldValue }] },
    params: {
      query: { idType },
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

export const useTrackEvent = () => {
  return useMutation({
    mutationFn: ({
      action,
      name,
      value,
      options: { isStagingEnv },
    }: {
      action: string;
      name: string;
      value?: string;
      options: { isStagingEnv?: boolean };
    }) => postTrackEvent({ action, name, value }, isStagingEnv),
  });
};

interface TrackEventParams {
  action: string;
  name: string;
  value?: string;
}

const postTrackEvent = async ({ action, name, value }: TrackEventParams, isStagingEnv = false) => {
  const apiClient = makeApiClient(isStagingEnv);

  const { data, error } = await apiClient.POST("/analytics/trackEvent", {
    body: { action, name, value, category: window.location.hostname },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
