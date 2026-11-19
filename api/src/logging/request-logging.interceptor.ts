import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
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

    // Décisions humaines : le corps porte des données personnelles (auteur, commentaire).
    // On ne le journalise pas — redaction ciblée par chemin, minimalement invasive.
    const isSensitiveBody = originalUrl.split("?")[0].startsWith("/decisions");

    this.logger.log("Incoming Request", {
      method,
      url: originalUrl,
      ip,
      tracked: shouldTrackApiUsage,
      // we have no sensitive information to be hidden from the logs (except sensitive routes,
      // see isSensitiveBody). And this helps a lot in term of debugging — might have to revise
      // this implementation in the future when addressing logs in a more structured manner
      body: isSensitiveBody ? { redacted: true } : ((body as Record<string, unknown>) ?? null),
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
              const controllerPath = this.reflector.get<string>(PATH_METADATA, context.getClass());
              const routeHandlerPath = this.reflector.get<string>(PATH_METADATA, context.getHandler());
              const endpoint = `/${controllerPath}/${routeHandlerPath}`.replace(/\/\//, "/").replace(/\/$/, "");

              void this.apiUsageService.recordRequest({
                method,
                endpoint,
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
}
