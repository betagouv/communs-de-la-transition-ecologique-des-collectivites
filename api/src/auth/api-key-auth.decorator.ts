import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiHeader } from "@nestjs/swagger";
import { ApiKeyGuard } from "./api-key-guard";

export function ApiKeyAuth() {
  return applyDecorators(
    UseGuards(ApiKeyGuard),
    ApiHeader({
      name: "x-api-key",
      description: "API key for authentication",
      required: true,
    }),
  );
}
