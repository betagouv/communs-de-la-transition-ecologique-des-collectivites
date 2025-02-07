import { ThrottlerModuleOptions } from "@nestjs/throttler";

// this config sets up the throttler module that limits requests to 100 per minute.
// this is per IP address, i.e if MEC backend makes 4 GET requests and 7 POST requests in one minute, it will be throttled.
// responding a 429 error.

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      ttl: 60, //ms
      limit: 50,
    },
  ],
};
