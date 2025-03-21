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
