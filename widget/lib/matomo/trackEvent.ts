interface TrackEventParams {
  category: string;
  action: string;
  name?: string;
  value?: number;
  isStagingEnv?: boolean;
}

export const trackEvent = ({ category, action, name, value, isStagingEnv }: TrackEventParams): void => {
  const env = isStagingEnv ? "staging" : "prod";
  const appendedCategory = `${category}_${env}`;
  if (window._paq) {
    window._paq.push(["trackEvent", appendedCategory, action, name, value]);
  }
};
