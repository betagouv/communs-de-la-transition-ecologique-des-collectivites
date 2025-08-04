import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { CustomLogger } from "./logger.service";
import { ApiUsageService } from "@/analytics/api-usage.service";
import { TRACK_API_USAGE_KEY } from "@/shared/decorator/track-api-usage.decorator";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private logger: CustomLogger,
    private reflector: Reflector,
    private apiUsageService: ApiUsageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { method, originalUrl, ip, body } = request;

    const shouldTrackApiUsage = this.reflector.get<boolean>(TRACK_API_USAGE_KEY, context.getHandler());

    this.logger.log("Incoming Request", {
      method,
      url: originalUrl,
      ip,
      tracked: shouldTrackApiUsage,
      // we have no sensitive information to be hidden from the logs. And this helps a lot in term of debugging
      // might have to revise this implementation in the future when addressing logs in a more structured manner
      body: (body as Record<string, unknown>) ?? null,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log("Request completed", {
            method,
            url: originalUrl,
            statusCode,
            duration: `${duration}ms`,
            tracked: shouldTrackApiUsage,
            serviceType: request.serviceType,
          });

          if (shouldTrackApiUsage) {
            try {
              void this.apiUsageService.recordRequest({
                method,
                endpoint: this.normalizeEndpoint(originalUrl),
                fullUrl: originalUrl,
                statusCode,
                responseTimeInMs: duration,
                serviceName: request.serviceType,
              });
            } catch (error) {
              this.logger.error("Failed to persist API request", { error, url: originalUrl });
            }
          }
        },
      }),
    );
  }
  private normalizeEndpoint(url: string): string {
    // Convert /projets/123e4567-e89b-12d3-a456-426614174000 to /projets/:id - we use uuid v7 in the db
    return url.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id").split("?")[0]; // Remove query params
  }
}
