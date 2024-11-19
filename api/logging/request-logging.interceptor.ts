import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
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
    const { method, originalUrl, ip } = request;

    this.logger.log("Incoming Request", {
      method,
      url: originalUrl,
      ip,
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
