import * as express from "express";
import { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createProxyMiddleware, responseInterceptor, Options } from "http-proxy-middleware";

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

  // Get config for Matomo injection
  const configService = app.get(ConfigService);
  const matomoSiteId = configService.get<string>("MATOMO_RESSOURCES_SITE_ID");
  const matomoUrl = configService.get<string>("MATOMO_URL", "https://stats.beta.gouv.fr");

  // Build Matomo script if configured
  const matomoScript = matomoSiteId
    ? `
<!-- Matomo Analytics -->
<script>
  var _paq = window._paq = window._paq || [];
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="${matomoUrl}/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '${matomoSiteId}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
</script>
<!-- End Matomo Analytics -->`
    : "";

  if (!matomoSiteId) {
    logger.warn("MATOMO_RESSOURCES_SITE_ID not configured - analytics disabled for ressources");
  }

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

        if (contentType.includes("text/html") && matomoScript) {
          let html = responseBuffer.toString("utf8");

          // Note: String.replace() only replaces the first occurrence, which is the desired
          // behavior here since we only want to inject Matomo once per HTML document.
          if (html.includes("</head>")) {
            html = html.replace("</head>", `${matomoScript}</head>`);
          } else if (html.includes("</body>")) {
            html = html.replace("</body>", `${matomoScript}</body>`);
          }

          return html;
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
      index: false, // Handle index manually for SPA routing
      fallthrough: true,
    }),
  );

  // 3. SPA fallback - serve index.html for non-file routes
  app.use("/ressources", (req: Request, res: Response, next: NextFunction) => {
    // Don't serve index.html for /cartographie (handled by proxy above)
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
