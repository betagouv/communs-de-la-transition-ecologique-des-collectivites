import { Request } from "express";

export const mockRequest = (service: "MEC" | "TET" | "RECOCO" | "UrbanVitaliz" | "SosPonts" | "FondVert") => {
  const apiKeys = {
    MEC: process.env.MEC_API_KEY,
    TET: process.env.TET_API_KEY,
    RECOCO: process.env.RECOCO_API_KEY,
    UrbanVitaliz: process.env.URBAN_VITALIZ_API_KEY,
    SosPonts: process.env.SOS_PONTS_API_KEY,
    FondVert: process.env.FOND_VERT_API_KEY,
  };

  return {
    headers: {
      authorization: `Bearer ${apiKeys[service]}`,
    },
  } as any as Request;
};
