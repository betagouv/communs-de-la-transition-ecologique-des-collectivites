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
 * Hardcoded URLs for external services hosted on Netlify.
 * Intentionally not configurable via environment variables because:
 * 1. These are fixed external resources that don't change between environments
 * 2. Simplifies deployment configuration and reduces risk of misconfiguration
 * 3. The URLs are public and don't contain sensitive information
 */
const CARTOGRAPHIE_URL = "https://communs-te.netlify.app";
const ANALYSES_CONVERGENCE_URL = "https://analyses-convergence.netlify.app";

/**
 * Creates a reverse proxy middleware for an external resource under /ressources/.
 * Handles path rewriting in HTML/JS responses and Matomo injection.
 */
const createRessourceProxy = (
  app: NestExpressApplication,
  options: {
    basePath: string;
    targetUrl: string;
    matomoService: MatomoService;
    errorLabel: string;
  },
) => {
  const { basePath, targetUrl, matomoService, errorLabel } = options;

  const proxyOptions: Options = {
    target: targetUrl,
    changeOrigin: true,
    selfHandleResponse: true,
    pathRewrite: {
      [`^${basePath}`]: "",
    },
    on: {
      proxyReq: (_proxyReq, req) => {
        logger.debug(`[Proxy] ${req.method} ${req.url} → ${targetUrl}`);
      },
      /* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/require-await */
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
        const contentType = proxyRes.headers["content-type"] ?? "";

        // Helper functions for path rewriting
        const rewritePath = (p: string) => `${basePath}${p}`;
        const shouldRewrite = (p: string) =>
          p.startsWith("/") && !p.startsWith("//") && !p.startsWith(`${basePath}/`) && !p.startsWith("/http");

        // Rewrite paths in HTML content
        if (contentType.includes("text/html")) {
          let html = responseBuffer.toString("utf8");

          // Rewrite HTML attributes (src, href, data-src, action, poster) with double or single quotes
          html = html.replace(
            /(src|href|data-src|action|poster)=(["'])(\/[^"']+)\2/g,
            (match: string, attr: string, quote: string, p: string) =>
              shouldRewrite(p) ? `${attr}=${quote}${rewritePath(p)}${quote}` : match,
          );

          // Rewrite JS string literals in inline scripts (for fetch, import, etc.)
          html = html.replace(/(fetch|import)\(["'`](\/[^"'`]+)["'`]\)/g, (match: string, fn: string, p: string) =>
            shouldRewrite(p) ? `${fn}("${rewritePath(p)}")` : match,
          );

          // Inject Matomo script using centralized service
          html = matomoService.injectIntoHtml(html);

          return html;
        }

        // Rewrite paths in JavaScript files
        if (contentType.includes("javascript")) {
          let js = responseBuffer.toString("utf8");

          // Rewrite string literals containing absolute paths that look like asset/file references.
          // Only rewrites paths starting with /assets/ or ending with a file extension,
          // to avoid corrupting regex literals in minified JS (e.g. /"/gi would become /"/ressources/.../gi).
          const isLikelyFilePath = (p: string) => p.startsWith("/assets/") || /\/[^/]+\.\w{2,5}$/.test(p);

          js = js.replace(/["'`](\/[^"'`\s]+)["'`]/g, (match: string, p: string) => {
            if (shouldRewrite(p) && isLikelyFilePath(p)) {
              const quote = match[0];
              return `${quote}${rewritePath(p)}${quote}`;
            }
            return match;
          });

          return js;
        }

        // Rewrite url() paths in CSS files (fonts, images, etc.)
        if (contentType.includes("text/css")) {
          let css = responseBuffer.toString("utf8");

          css = css.replace(/url\((\/[^)]+)\)/g, (match: string, p: string) =>
            shouldRewrite(p) ? `url(${rewritePath(p)})` : match,
          );

          return css;
        }

        return responseBuffer;
      }),
      error: (err, req, res) => {
        logger.error(`[Proxy Error] ${req.url}: ${err.message}`);
        (res as Response).status(502).json({
          error: `${errorLabel} temporairement indisponible`,
          message: "Veuillez réessayer plus tard",
        });
      },
    },
  };

  app.use(basePath, createProxyMiddleware(proxyOptions));
  logger.log(`${errorLabel} proxy configured → ${targetUrl}`);
};

/** Paths handled by proxy middleware (excluded from SPA fallback) */
const PROXIED_PATHS = ["/cartographie", "/analyses-convergence"];

export const serveRessources = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const ressourcesPath = path.join(projectRoot, "ressources-pages", "dist");

  // Get Matomo service for injection
  const matomoService = app.get(MatomoService);

  // 1. Set up proxies FIRST (before static files)
  createRessourceProxy(app, {
    basePath: "/ressources/cartographie",
    targetUrl: CARTOGRAPHIE_URL,
    matomoService,
    errorLabel: "Cartographie",
  });

  createRessourceProxy(app, {
    basePath: "/ressources/analyses-convergence",
    targetUrl: ANALYSES_CONVERGENCE_URL,
    matomoService,
    errorLabel: "Analyses convergence",
  });

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
    // Don't serve index.html for proxied paths (handled above)
    if (PROXIED_PATHS.some((p) => req.path.startsWith(p))) {
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
