import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import cors from "cors";
import { match } from "path-to-regexp";

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // we have only 2 routes that need CORS because they are the one being called by the widget
    // /projects/:projectId/extra-fields through a POST request to enable the widget to save the extra fields
    // /services/project/:projectId through a GET request to get the services for current project in the widget
    const corsEnabledRoutes = ["/projects/:projectId/extra-fields", "/services/project/:projectId"];
    const isAllowedRoute = corsEnabledRoutes.some((route) => match(route)(req.originalUrl));

    if (isAllowedRoute) {
      cors({
        origin: allowedOrigins,
        methods: ["GET", "POST"],
      })(req, res, next);
    } else {
      next();
    }
  }
}
