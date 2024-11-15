import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeyGuard } from "./api-key-guard";

export function ApiKeyAuth() {
  return applyDecorators(UseGuards(ApiKeyGuard), ApiBearerAuth());
}
