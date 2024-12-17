import { Request } from "express";
import { ServiceType } from "@/shared/types";

export const mockRequest = (serviceType: ServiceType): Request => {
  return { serviceType } as any as Request;
};
