import { Request } from "express";

export const extractApiKey = (request: Request): string => {
  const authHeader = request.headers.authorization;
  const apiKey = authHeader?.split(" ")[1];

  if (!apiKey) {
    throw new Error("No API key found in request");
  }
  return apiKey;
};
