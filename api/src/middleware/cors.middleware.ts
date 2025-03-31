import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import cors from "cors";
import { match } from "path-to-regexp";

const extractDomain = (origin: string): string => {
  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return origin;
  }
};

export const isOriginAllowed = (origin: string | undefined) => {
  if (!origin) return false;

  console.log(process.env.CORS_ALLOWED_DOMAINS, process.env.CORS_ALLOWED_DOMAINS);
  if (!process.env.CORS_ALLOWED_DOMAINS) {
    throw new Error("CORS_ALLOWED_DOMAINS is not set");
    return;
  }

  const allowedDomains = process.env.CORS_ALLOWED_DOMAINS.split(",");
  const requestDomain = extractDomain(origin);
  // Convert allowed domains patterns to regex patterns
  const allowedDomainPatterns = allowedDomains.map((pattern) => pattern.replace(/\./g, "\\.").replace(/\*/g, ".*"));
  return allowedDomainPatterns.some((pattern) => new RegExp(`^${pattern}$`).test(requestDomain));
};

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // we have only 2 routes that need CORS because they are the one being called by the widget
    // /projects/:projectId/extra-fields through a POST request to enable the widget to save the extra fields
    // /services/project/:projectId through a GET request to get the services for current project in the widget
    const corsEnabledRoutes = ["/projets/:projectId/extra-fields", "/services/project/:projectId"];
    const isAllowedRoute = corsEnabledRoutes.some((route) => match(route)(req.originalUrl));
    if (isAllowedRoute) {
      cors({
        origin: (origin, callback) => {
          if (isOriginAllowed(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`${origin} not allowed by CORS`));
          }
        },
        methods: ["GET", "POST"],
      })(req, res, next);
    } else {
      next();
    }
  }
}
