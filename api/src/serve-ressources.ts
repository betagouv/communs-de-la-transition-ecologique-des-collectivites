import * as express from "express";
import { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";
import { createProxyMiddleware, responseInterceptor, Options } from "http-proxy-middleware";
import { MatomoService } from "@/matomo";

const logger = new Logger("ServeRessources");

/**
 * Hardcoded URL for the cartography service hosted on Netlify.
 * This is intentionally not configurable via environment variables because:
 * 1. The cartography is a fixed external resource that doesn't change between environments
 * 2. Simplifies deployment configuration and reduces risk of misconfiguration
 * 3. The URL is public and doesn't contain sensitive information
 */
const CARTOGRAPHIE_URL = "https://communs-te.netlify.app";

export const serveRessources = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const ressourcesPath = path.join(projectRoot, "ressources-pages", "dist");

  // Get Matomo service for injection
  const matomoService = app.get(MatomoService);

  // 1. Set up proxy for /ressources/cartographie FIRST (before static files)
  const proxyOptions: Options = {
    target: CARTOGRAPHIE_URL,
    changeOrigin: true,
    selfHandleResponse: true,
    pathRewrite: {
      "^/ressources/cartographie": "",
    },
    on: {
      proxyReq: (_proxyReq, req) => {
        logger.debug(`[Proxy] ${req.method} ${req.url} → ${CARTOGRAPHIE_URL}`);
      },
      /* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/require-await */
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
        const contentType = proxyRes.headers["content-type"] ?? "";

        // Helper functions for path rewriting
        const rewritePath = (path: string) => `/ressources/cartographie${path}`;
        const shouldRewrite = (path: string) =>
          path.startsWith("/") &&
          !path.startsWith("//") &&
          !path.startsWith("/ressources/cartographie/") &&
          !path.startsWith("/http");

        // Rewrite paths in HTML content
        if (contentType.includes("text/html")) {
          let html = responseBuffer.toString("utf8");

          // Rewrite HTML attributes (src, href, data-src, action, poster)
          html = html.replace(
            /(src|href|data-src|action|poster)="(\/[^"]+)"/g,
            (match: string, attr: string, path: string) =>
              shouldRewrite(path) ? `${attr}="${rewritePath(path)}"` : match,
          );

          // Rewrite JS string literals in inline scripts (for fetch, import, etc.)
          html = html.replace(/(fetch|import)\(["'`](\/[^"'`]+)["'`]\)/g, (match: string, fn: string, path: string) =>
            shouldRewrite(path) ? `${fn}("${rewritePath(path)}")` : match,
          );

          // Inject Matomo script using centralized service
          html = matomoService.injectIntoHtml(html);

          return html;
        }

        // Rewrite paths in JavaScript files
        if (contentType.includes("javascript")) {
          let js = responseBuffer.toString("utf8");

          // Rewrite string literals containing absolute paths
          // Matches: "/path", '/path', `/path`
          js = js.replace(/["'`](\/[^"'`\s]+)["'`]/g, (match: string, path: string) => {
            if (shouldRewrite(path)) {
              const quote = match[0];
              return `${quote}${rewritePath(path)}${quote}`;
            }
            return match;
          });

          return js;
        }

        return responseBuffer;
      }),
      error: (err, req, res) => {
        logger.error(`[Proxy Error] ${req.url}: ${err.message}`);
        (res as Response).status(502).json({
          error: "Cartographie temporairement indisponible",
          message: "Veuillez réessayer plus tard",
        });
      },
    },
  };

  app.use("/ressources/cartographie", createProxyMiddleware(proxyOptions));
  logger.log(`Cartographie proxy configured → ${CARTOGRAPHIE_URL}`);

  // 2. Serve static assets (only if dist exists)
  if (!fs.existsSync(ressourcesPath)) {
    logger.warn(`Ressources pages not found at ${ressourcesPath} - /ressources will not be served`);
    return;
  }

  app.use(
    "/ressources",
    express.static(ressourcesPath, {
      index: false, // Handle index manually for SPA routing and Matomo injection
      fallthrough: true,
    }),
  );

  // 3. SPA fallback - serve index.html with Matomo injection for non-file routes
  app.use("/ressources", (req: Request, res: Response, next: NextFunction) => {
    // Don't serve index.html for /cartographie (handled by proxy above)
    if (req.path.startsWith("/cartographie")) {
      return next();
    }

    // Serve index.html with Matomo injection for SPA routes
    const indexPath = path.join(ressourcesPath, "index.html");
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

  logger.log(`Serving ressources pages from ${ressourcesPath} with Matomo injection`);
};
