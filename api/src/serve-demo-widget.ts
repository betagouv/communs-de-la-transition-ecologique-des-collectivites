import * as express from "express";
import path from "path";
import { INestApplication } from "@nestjs/common";

export const serveDemoWidget = (app: INestApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const sandboxPath = path.join(projectRoot, "widget-sandbox", "dist");
  app.use("/sandbox", express.static(sandboxPath));
};
