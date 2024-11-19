import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { CustomLogger } from "logging/logger.service";
import { randomUUID } from "crypto";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private logger: CustomLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorResponse = exception.getResponse();

      this.logger.error("HTTP Exception", {
        status,
        error: errorResponse,
        path: request.url,
      });

      return response.status(status).json({
        statusCode: status,
        ...(typeof errorResponse === "object"
          ? errorResponse
          : { message: errorResponse }),
      });
    }

    const errorInstanceId = randomUUID();

    this.logger.error("Unhandled Exception", {
      errorInstanceId,
      exception: exception instanceof Error ? exception.message : exception,
      stack: exception instanceof Error ? exception.stack : undefined,
      path: request.url,
    });

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorInstanceId,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: "Internal server error",
    });
  }
}