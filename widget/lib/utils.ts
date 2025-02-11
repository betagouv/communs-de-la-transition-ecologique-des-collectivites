export const getApiUrl = (isStaging?: boolean, isDev = import.meta.env.DEV) => {
  if (isDev) return "http://localhost:3000";
  return `https://les-communs-transition-ecologique-api-${isStaging ? "staging" : "prod"}.osc-fr1.scalingo.io`;
};
