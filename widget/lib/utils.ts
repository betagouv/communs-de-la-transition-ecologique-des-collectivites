export const getApiUrl = (isStaging?: boolean, isDev = import.meta.env.DEV) => {
  if (isDev) return "http://localhost:3000";
  if (isStaging) return "https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io";
  return "https://api.collectivites.beta.gouv.fr";
};
