import path from "path";
import { NestExpressApplication } from "@nestjs/platform-express";
import { MatomoService, serveStaticWithMatomo } from "@/matomo";

export const serveStatisticsDashboard = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const statisticsPath = path.join(projectRoot, "statistics-dashboard", "dist");
  const matomoService = app.get(MatomoService);

  serveStaticWithMatomo(app, matomoService, {
    urlPath: "/statistics",
    staticPath: statisticsPath,
    label: "statistics dashboard",
  });
};
