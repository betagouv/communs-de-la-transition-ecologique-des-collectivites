import * as express from "express";
import { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";

const logger = new Logger("ServeRessources");

export const serveRessources = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const ressourcesPath = path.join(projectRoot, "ressources-pages", "dist");

  if (!fs.existsSync(ressourcesPath)) {
    logger.warn(`Ressources pages not found at ${ressourcesPath} - /ressources will not be served`);
    return;
  }

  // Serve static assets
  app.use(
    "/ressources",
    express.static(ressourcesPath, {
      index: false, // Handle index manually for SPA routing
      fallthrough: true,
    }),
  );

  // SPA fallback - serve index.html for non-file routes (except /cartographie which is proxied)
  app.use("/ressources", (req: Request, res: Response, next: NextFunction) => {
    // Let the proxy middleware handle /cartographie
    if (req.path.startsWith("/cartographie")) {
      return next();
    }

    // Serve index.html for SPA routes
    const indexPath = path.join(ressourcesPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  logger.log(`Serving ressources pages from ${ressourcesPath}`);
};
