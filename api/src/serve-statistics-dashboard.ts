import * as express from "express";
import path from "path";
import { NestExpressApplication } from "@nestjs/platform-express";

export const serveStatisticsDashboard = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const statisticsPath = path.join(projectRoot, "statistics-dashboard", "dist");
  app.use("/statistics", express.static(statisticsPath));
};
