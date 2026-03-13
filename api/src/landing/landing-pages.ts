import { Request, Response, NextFunction } from "express";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";
import { MatomoService } from "@/matomo";
import { homePage, referentielPage, opendataPage, apiProjetsPage } from "./templates";

const logger = new Logger("LandingPages");

export const serveLandingPages = (app: NestExpressApplication) => {
  const matomoService = app.get(MatomoService);

  const routes: Record<string, () => string> = {
    "/": homePage,
    "/referentiel": referentielPage,
    "/opendata": opendataPage,
    "/api-projets": apiProjetsPage,
  };

  for (const [path, template] of Object.entries(routes)) {
    app.use(path, (req: Request, res: Response, next: NextFunction) => {
      // Only handle exact path matches (not sub-paths handled by NestJS)
      if (req.path !== "/" && req.path !== "") {
        return next();
      }
      // Only handle GET requests
      if (req.method !== "GET") {
        return next();
      }

      const html = matomoService.injectIntoHtml(template());
      res.type("html").send(html);
    });
  }

  logger.log("Landing pages configured for /, /referentiel, /opendata, /api-projets");
};
