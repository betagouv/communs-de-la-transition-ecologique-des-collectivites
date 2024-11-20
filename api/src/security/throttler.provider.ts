import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Provider } from "@nestjs/common";

export const ThrottlerGuardProvider: Provider = {
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
};
