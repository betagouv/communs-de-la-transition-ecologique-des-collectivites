import type { DashboardData } from "../types";

const apiUrl = `${import.meta.env.VITE_STATISTIC_PAGE_API_BASE_URL}/analytics/dashboard`;

export const getDashboardData = async (platform = "all"): Promise<DashboardData> => {
  try {
    const params = new URLSearchParams({
      period: "month",
      date: "last6",
      hostingPlatform: platform,
    });

    const response = await fetch(`${apiUrl}?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as DashboardData;
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw new Error("Impossible de récupérer les données de Matomo");
  }
};
