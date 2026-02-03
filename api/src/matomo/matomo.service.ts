import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Service for generating Matomo analytics tracking scripts.
 * Used to inject tracking into server-side rendered or proxied HTML pages.
 */
@Injectable()
export class MatomoService {
  private readonly logger = new Logger(MatomoService.name);
  private readonly matomoScript: string;
  private readonly inlineScript: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const siteId = this.configService.get<string>("MATOMO_RESSOURCES_SITE_ID");
    const matomoUrl = this.configService.get<string>("MATOMO_URL", "https://stats.beta.gouv.fr");

    this.isEnabled = !!siteId;

    if (!siteId) {
      this.logger.warn("MATOMO_RESSOURCES_SITE_ID not configured - analytics disabled for static pages");
      this.matomoScript = "";
      this.inlineScript = "";
      return;
    }

    // Inline script for contexts like Swagger that use customJsStr
    // - disableCookies: required for CNIL compliance without consent banner
    // - optUserOut check: respects user opt-out preference stored in localStorage
    // See: https://doc.incubateur.net/communaute/les-outils-de-la-communaute/autres-services/matomo
    this.inlineScript = `
var _paq = window._paq = window._paq || [];
_paq.push(['disableCookies']);
if (localStorage.getItem('matomo-opt-out') === 'true') {
  _paq.push(['optUserOut']);
}
_paq.push(['trackPageView']);
_paq.push(['enableLinkTracking']);
(function() {
  var u="${matomoUrl}/";
  _paq.push(['setTrackerUrl', u+'matomo.php']);
  _paq.push(['setSiteId', '${siteId}']);
  var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
  g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
})();`;

    this.matomoScript = `
<!-- Matomo Analytics (CNIL exempt - no cookies, opt-out supported) -->
<script>
  var _paq = window._paq = window._paq || [];
  _paq.push(['disableCookies']);
  if (localStorage.getItem('matomo-opt-out') === 'true') {
    _paq.push(['optUserOut']);
  }
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="${matomoUrl}/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '${siteId}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
</script>
<!-- End Matomo Analytics -->`;

    this.logger.log(`Matomo analytics enabled with site ID: ${siteId} (cookies disabled for CNIL compliance)`);
  }

  /**
   * Returns the Matomo tracking script to inject into HTML pages.
   * Returns empty string if Matomo is not configured.
   */
  getScript(): string {
    return this.matomoScript;
  }

  /**
   * Whether Matomo tracking is enabled (MATOMO_RESSOURCES_SITE_ID is set).
   */
  isTrackingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Injects Matomo script into HTML content.
   * Tries to inject before </head>, falls back to before </body>.
   */
  injectIntoHtml(html: string): string {
    if (!this.isEnabled) {
      return html;
    }

    if (html.includes("</head>")) {
      return html.replace("</head>", `${this.matomoScript}</head>`);
    }

    if (html.includes("</body>")) {
      return html.replace("</body>", `${this.matomoScript}</body>`);
    }

    return html;
  }

  /**
   * Returns the inline JavaScript code for Matomo (without script tags).
   * Useful for contexts like Swagger UI's customJsStr option.
   */
  getInlineScript(): string {
    return this.inlineScript;
  }
}
