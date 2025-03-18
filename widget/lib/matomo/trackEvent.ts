interface TrackEventParams {
  category: string;
  action: string;
  name?: string;
  value?: number;
}

export const trackEvent = ({ category, action, name, value }: TrackEventParams): void => {
  if (window._paq) {
    window._paq.push(["trackEvent", category, action, name, value]);
  }
};
