import * as express from "express";
import { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";
import { MatomoService } from "./matomo.service";

const logger = new Logger("ServeStaticWithMatomo");

interface ServeStaticOptions {
  /** The URL path to serve the static files at (e.g., "/statistics") */
  urlPath: string;
  /** The directory path containing the static files */
  staticPath: string;
  /** Optional label for logging */
  label?: string;
}

/**
 * Serves static files with Matomo injection for HTML pages.
 * This handles SPA-style routing by serving index.html for non-file routes.
 */
export const serveStaticWithMatomo = (
  app: NestExpressApplication,
  matomoService: MatomoService,
  options: ServeStaticOptions,
): void => {
  const { urlPath, staticPath, label = urlPath } = options;

  if (!fs.existsSync(staticPath)) {
    logger.warn(`Static files not found at ${staticPath} - ${label} will not be served`);
    return;
  }

  // Serve static assets (JS, CSS, images, etc.)
  app.use(
    urlPath,
    express.static(staticPath, {
      index: false, // Handle index manually for Matomo injection
      fallthrough: true,
    }),
  );

  // SPA fallback - serve index.html with Matomo injection
  app.use(urlPath, (_req: Request, res: Response, next: NextFunction) => {
    const indexPath = path.join(staticPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      return next();
    }

    fs.readFile(indexPath, "utf8", (err, html) => {
      if (err) {
        logger.error(`Failed to read ${indexPath}: ${err.message}`);
        return next(err);
      }

      const htmlWithMatomo = matomoService.injectIntoHtml(html);
      res.type("html").send(htmlWithMatomo);
    });
  });

  logger.log(`Serving ${label} from ${staticPath} with Matomo injection`);
};
