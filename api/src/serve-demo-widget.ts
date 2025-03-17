import * as express from "express";
import path from "path";
import { NestExpressApplication } from "@nestjs/platform-express";

export const serveDemoWidget = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const sandboxPath = path.join(projectRoot, "widget-sandbox", "dist");
  app.use("/sandbox", express.static(sandboxPath));
};
