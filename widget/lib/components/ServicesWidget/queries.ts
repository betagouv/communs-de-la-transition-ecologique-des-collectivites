import { paths } from "../../generated-types.ts";
import createFetchClient from "openapi-fetch";
import { getApiUrl } from "../../utils.ts";
import { useMutation, useQuery, useQueryClient, UseQueryResult } from "@tanstack/react-query";
import { Collectivite, ExtraFields, Service, ServicesWidgetProps } from "./types.ts";
import { IdType } from "../../shared-types";

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
  projectId?: string;
  idType: IdType;
  options: {
    isStagingEnv?: boolean;
    debug?: boolean;
    enabled?: boolean;
  };
}

interface BaseQueryParamsWithProjectId extends BaseQueryParams {
  projectId: string;
}

// -------------- Services by Projects - GET -------------- //
export const useGetServicesByProjectId = ({ projectId, ...rest }: BaseQueryParams): UseQueryResult<Service[]> => {
  return useQuery({
    queryKey: ["project-services", projectId],
    queryFn: () => fetchServicesByProjectId({ ...rest, projectId: projectId! }),
    enabled: rest.options.enabled,
  });
};

const fetchServicesByProjectId = async ({ projectId, idType, options }: BaseQueryParamsWithProjectId) => {
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
export const useGetProjectPublicInfo = (params: BaseQueryParamsWithProjectId): UseQueryResult<Collectivite> => {
  return useQuery({
    queryKey: ["project-public-info", params.projectId],
    queryFn: () => fetchProjectPublicInfo(params),
    enabled: params.options.enabled,
    // the only needed data from the project for now are the collectivite, furthermore all the iframe url we have are mono collectivite.
    // we'll need to add support for multi collectivité in iframe url once we integrate Aide territoire
    select: (data) => data.collectivites[0],
  });
};

const fetchProjectPublicInfo = async ({ projectId, idType, options }: BaseQueryParamsWithProjectId) => {
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
export const useGetProjectExtraFields = ({
  projectId,
  idType,
  options,
}: BaseQueryParams): UseQueryResult<ExtraFields> => {
  return useQuery({
    queryKey: ["project-extra-fields", projectId],
    queryFn: () => fetchProjectExtraFields({ projectId: projectId!, idType, options }),
    enabled: options.enabled,
  });
};

const fetchProjectExtraFields = async ({ projectId, idType, options }: BaseQueryParamsWithProjectId) => {
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

// -------------- Services by Context - GET -------------- //
export const useGetServicesByContext = ({
  context,
  options,
}: {
  context: ServicesWidgetProps["context"];
  options: BaseQueryParams["options"];
}) => {
  return useQuery({
    queryKey: ["context-services", context],
    queryFn: () => fetchServicesByContext(context, options),
    enabled: Boolean(context),
  });
};

const fetchServicesByContext = async (
  context: ServicesWidgetProps["context"],
  options: { isStagingEnv?: boolean; debug?: boolean },
) => {
  const { isStagingEnv } = options;
  const apiUrl = getApiUrl(isStagingEnv);

  const params = new URLSearchParams();

  if (context?.competences?.length) {
    context.competences.forEach((competence) => {
      params.append("competences", competence);
    });
  }

  if (context?.leviers?.length) {
    context.leviers.forEach((levier) => {
      params.append("leviers", levier);
    });
  }

  if (context?.phases?.length) {
    context.phases.forEach((phase) => {
      params.append("phases", phase);
    });
  }

  if (context?.regions?.length) {
    context.regions.forEach((region) => {
      params.append("regions", region);
    });
  }

  const url = `${apiUrl}/services/search/context?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<Service[]>;
};
