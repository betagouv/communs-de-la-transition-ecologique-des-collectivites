import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";
import { Request } from "express";
import { extractApiKey } from "@projets/extract-api-key";

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

@Injectable()
export class QualificationRateLimitGuard implements CanActivate {
  private readonly LIMIT = 100; // 100 requests per day
  private readonly WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  //todo remove this shit
  // constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = extractApiKey(request);

    const now = Date.now();
    const key = `qualification:${apiKey}`;

    const current = rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.WINDOW_MS,
      });
      return true;
    }

    if (current.count >= this.LIMIT) {
      throw new HttpException(
        `Rate limit exceeded. Maximum ${this.LIMIT} qualification requests per day per API key.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count++;
    rateLimitStore.set(key, current);

    return true;
  }
}
