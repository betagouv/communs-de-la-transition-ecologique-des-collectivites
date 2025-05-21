import { getApiUrl } from "../utils.ts";

interface TrackEventParams {
  action: string;
  name?: string;
  value?: number;
  isStagingEnv?: boolean;
}

export const trackEvent = ({ action, name, value, isStagingEnv }: TrackEventParams): void => {
  const hostDomain = window.location.hostname;
  const env = isStagingEnv ? "staging" : "prod";
  const appendedCategory = `Widget-service_${env}-${hostDomain}`;
  if (window._paq) {
    window._paq.push(["trackEvent", appendedCategory, action, name, value]);
  }
};

export const trackEventv2 = async ({ action, name, value, isStagingEnv }: TrackEventParams): Promise<void> => {
  const hostDomain = window.location.hostname;
  const env = isStagingEnv ? "staging" : "prod";
  const category = `Widget-service_${env}-${hostDomain}`;
  const apiUrl = getApiUrl(isStagingEnv);

  try {
    const response = await fetch(`${apiUrl}/analytics/trackEvent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        category,
        action,
        name,
        value,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tracking failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Error tracking event:", error);
  }
};
