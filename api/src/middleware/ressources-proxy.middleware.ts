import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { createProxyMiddleware, responseInterceptor, Options } from "http-proxy-middleware";

const CARTOGRAPHIE_URL = "https://communs-te.netlify.app";

@Injectable()
export class RessourcesProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RessourcesProxyMiddleware.name);
  private proxy: RequestHandler;

  constructor(private configService: ConfigService) {
    const matomoSiteId = this.configService.get<string>("MATOMO_RESSOURCES_SITE_ID");
    const matomoUrl = this.configService.get<string>("MATOMO_URL", "https://stats.beta.gouv.fr");

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
      this.logger.warn("MATOMO_RESSOURCES_SITE_ID not configured - analytics disabled for ressources");
    }

    const options: Options = {
      target: CARTOGRAPHIE_URL,
      changeOrigin: true,
      selfHandleResponse: true,
      pathRewrite: {
        "^/ressources/cartographie": "",
      },
      on: {
        proxyReq: (_proxyReq, req) => {
          this.logger.debug(`[Proxy] ${req.method} ${req.url} → ${CARTOGRAPHIE_URL}`);
        },
        /* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/require-await */
        proxyRes: responseInterceptor(async (responseBuffer, proxyRes) => {
          const contentType = proxyRes.headers["content-type"] ?? "";

          if (contentType.includes("text/html") && matomoScript) {
            let html = responseBuffer.toString("utf8");

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
          this.logger.error(`[Proxy Error] ${req.url}: ${err.message}`);
          (res as Response).status(502).json({
            error: "Cartographie temporarily unavailable",
            message: "Please try again later",
          });
        },
      },
    };

    this.proxy = createProxyMiddleware(options);
    this.logger.log(`Cartographie proxy configured → ${CARTOGRAPHIE_URL}`);
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (req.path.startsWith("/ressources/cartographie")) {
      return this.proxy(req, res, next);
    }

    next();
  }
}
