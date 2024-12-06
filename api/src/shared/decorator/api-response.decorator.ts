import { applyDecorators, Type } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { ErrorResponse } from "../dto/error.response";

export interface ApiResponseOptions {
  successStatus: number;
  response: Type<unknown>;
  description?: string;
  isArray?: boolean;
}

export const ApiEndpointResponses = (options: ApiResponseOptions) => {
  return applyDecorators(
    ApiResponse({
      status: options.successStatus,
      type: options.response,
      description: options.description,
      isArray: options.isArray,
    }),
    ApiResponse({
      status: "default",
      type: ErrorResponse,
      description: "Error response",
    }),
  );
};
