import { ThrottlerModuleOptions } from "@nestjs/throttler";

// this config sets up the throttler module that limits requests to 100 per minute.
// this is per IP address, i.e if MEC backend makes 40 GET requests and 61 POST requests in a minute, it will be throttled.
// responding a 429 error.

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60_000, //ms
      limit: 100,
    },
  ],
};
