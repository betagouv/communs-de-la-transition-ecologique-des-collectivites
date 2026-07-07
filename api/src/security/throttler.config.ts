import { ThrottlerModuleOptions } from "@nestjs/throttler";

// this config sets up the throttler module that limits requests to 50 per minute.
// this is per IP address, i.e if MEC backend makes 4 GET requests and 7 POST requests in one minute, it will be throttled.
// responding a 429 error.
// NB: @nestjs/throttler 6.x expresses ttl in MILLISECONDS — 60_000 = 1 minute.

// Surcharge par env pour les environnements de test (la suite e2e dépasse 50 req/min
// depuis une seule IP — cf. e2e-global-setup qui pose THROTTLER_LIMIT).
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: Number(process.env.THROTTLER_TTL_MS ?? 60000), // 1 minute (ms)
      limit: Number(process.env.THROTTLER_LIMIT ?? 50),
    },
  ],
};
