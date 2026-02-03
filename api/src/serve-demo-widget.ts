import path from "path";
import { NestExpressApplication } from "@nestjs/platform-express";
import { MatomoService, serveStaticWithMatomo } from "@/matomo";

export const serveDemoWidget = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const sandboxPath = path.join(projectRoot, "widget-sandbox", "dist");
  const matomoService = app.get(MatomoService);

  serveStaticWithMatomo(app, matomoService, {
    urlPath: "/sandbox",
    staticPath: sandboxPath,
    label: "widget sandbox",
  });
};
