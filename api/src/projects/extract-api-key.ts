import { Request } from "express";

/**
 * Extracts the API key from the request's authorization header.
 * Safe to use after ApiKeyGuard as it guarantees the presence of a valid API key.
 */
export const extractApiKey = (request: Request): string => {
  const authHeader = request.headers.authorization;
  const apiKey = authHeader?.split(" ")[1];
  // We can safely cast here as ApiKeyGuard ensures a valid API key
  return apiKey!;
};
