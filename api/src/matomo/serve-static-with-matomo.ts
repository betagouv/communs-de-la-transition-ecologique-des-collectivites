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

const MATOMO_ORIGIN = "https://stats.beta.gouv.fr";
const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILES = "https://fonts.gstatic.com";

// CSP allows DSFR inline styles (required by @codegouvfr/react-dsfr), Marianne
// webfont from Google Fonts (loaded by the statistics-dashboard index.html),
// and connections to Matomo. The Matomo inline pageview script is whitelisted
// via its SHA-256 hash (computed at runtime by MatomoService) to avoid
// falling back to 'unsafe-inline'.
const buildSecurityHeaders = (matomoInlineScriptHash: string): Record<string, string> => ({
  "Content-Security-Policy": [
    "default-src 'self'",
    `script-src 'self' ${MATOMO_ORIGIN} ${matomoInlineScriptHash}`.trim(),
    `style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_CSS}`,
    "img-src 'self' data: https:",
    `font-src 'self' data: ${GOOGLE_FONTS_FILES}`,
    `connect-src 'self' ${MATOMO_ORIGIN}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
});

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
      const headers = buildSecurityHeaders(matomoService.getInlineScriptCspHash());
      for (const [header, value] of Object.entries(headers)) {
        res.setHeader(header, value);
      }
      res.type("html").send(htmlWithMatomo);
    });
  });

  logger.log(`Serving ${label} from ${staticPath} with Matomo injection`);
};
