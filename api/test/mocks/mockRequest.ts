import { Request } from "express";

export const mockRequest = (service: "MEC" | "TET" | "RECOCO") => {
  const apiKeys = {
    MEC: process.env.MEC_API_KEY,
    TET: process.env.TET_API_KEY,
    RECOCO: process.env.RECOCO_API_KEY,
  };

  return {
    headers: {
      authorization: `Bearer ${apiKeys[service]}`,
    },
  } as any as Request;
};
