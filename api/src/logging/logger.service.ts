import { Injectable, LoggerService } from "@nestjs/common";
import { createLogger, format, transports } from "winston";

@Injectable()
export class CustomLogger implements LoggerService {
  private logger = createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    silent: process.env.NODE_ENV === "test",
    transports: [
      new transports.Console({
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.printf(({ timestamp, level, message, ...metadata }) => {
            return `[${timestamp}] ${level}: ${message} ${
              Object.keys(metadata).length ? JSON.stringify(metadata) : ""
            }`;
          }),
        ),
      }),
    ],
  });

  log(message: string, metadata: Record<string, any> = {}) {
    this.logger.info(message, metadata);
  }

  error(message: string, metadata: Record<string, any> = {}) {
    this.logger.error(message, metadata);
  }

  warn(message: string, metadata: Record<string, any> = {}) {
    this.logger.warn(message, metadata);
  }

  debug(message: string, metadata: Record<string, any> = {}) {
    this.logger.debug(message, metadata);
  }
}
