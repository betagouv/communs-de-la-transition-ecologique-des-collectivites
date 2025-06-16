import type { DashboardData } from "../types";

//todo make it base on env var
const apiUrl = "http://localhost:3000/analytics/dashboard";

export const getDashboardData = async (platform = "all"): Promise<DashboardData> => {
  try {
    const params = new URLSearchParams({
      period: "month",
      date: "last6",
      ...(platform !== "all" ? { platform } : {}),
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
