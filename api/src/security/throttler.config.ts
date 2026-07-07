import { ThrottlerModuleOptions } from "@nestjs/throttler";

// this config sets up the throttler module that limits requests to 50 per minute.
// this is per IP address, i.e if MEC backend makes 4 GET requests and 7 POST requests in one minute, it will be throttled.
// responding a 429 error.
// NB: @nestjs/throttler 6.x expresses ttl in MILLISECONDS — 60_000 = 1 minute.

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60000, // 1 minute (ms)
      limit: 50,
    },
  ],
};
