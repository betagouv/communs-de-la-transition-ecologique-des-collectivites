import type { ApiUsageData, WidgetUsageData } from "../types";

const apiUrl = `${import.meta.env.VITE_STATISTIC_PAGE_API_BASE_URL}/analytics`;

export const getWidgetUsageData = async (platform = "all"): Promise<WidgetUsageData> => {
  try {
    const params = new URLSearchParams({
      period: "month",
      date: "last6",
      hostingPlatform: platform,
    });

    const response = await fetch(`${apiUrl}/widget-usage?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as WidgetUsageData;
  } catch (error) {
    console.error("Failed to fetch widget usage data:", error);
    throw new Error("Impossible de récupérer les données du widget");
  }
};

export const getApiUsageData = async (): Promise<ApiUsageData> => {
  try {
    const response = await fetch(`${apiUrl}/api-usage`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as ApiUsageData;
  } catch (error) {
    console.error("Failed to fetch api usage data:", error);
    throw new Error("Impossible de récupérer les données de l'api");
  }
};
