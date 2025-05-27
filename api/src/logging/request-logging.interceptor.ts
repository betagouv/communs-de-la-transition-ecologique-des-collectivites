import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { CustomLogger } from "./logger.service";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private logger: CustomLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { method, originalUrl, ip, body } = request;

    this.logger.log("Incoming Request", {
      method,
      url: originalUrl,
      ip,
      // we have no sensitive information to be hidden from the logs. And this helps a lot in term of debugging
      // might have to revise this implementation in the future when addressing logs in a more structured manner
      body: (body as Record<string, unknown>) ?? null,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse<Response>();
          const duration = Date.now() - startTime;

          this.logger.log("Request completed", {
            method,
            url: originalUrl,
            statusCode: response.statusCode,
            duration: `${duration}ms`,
          });
        },
      }),
    );
  }
}
