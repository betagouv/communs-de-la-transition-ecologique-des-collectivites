import * as express from "express";
import { Request, Response, NextFunction } from "express";
import * as path from "path";
import * as fs from "fs";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";

const logger = new Logger("ServeBackOffice");

/**
 * Sert le back-office (SPA) sur `/back-office`, comme l'API sert déjà le statistics-dashboard.
 *
 * PAS DE MATOMO, PAS DE PROXY. C'est un outil interne d'administration : aucune mesure d'audience,
 * et il parle à l'API en same-origin (voir back-office/src/api.ts), donc rien à réécrire.
 *
 * SÉCURITÉ. La page est publique, mais INUTILE sans la clé d'administration : toute action passe
 * par les endpoints /admin, tous derrière ServiceApiKeyGuard. Servir le HTML ne donne aucun droit.
 *
 * SUPPRESSIBILITÉ PRÉSERVÉE. Si `back-office/dist` n'existe pas (build non lancé, ou dossier
 * supprimé), on NE sert rien et l'API démarre normalement. Retirer le back-office reste donc :
 * `rm -rf back-office/`, retirer la ligne `build:back-office`, et cet appel dans main.ts. Aucun
 * endpoint de l'API n'en dépend.
 */
export const serveBackOffice = (app: NestExpressApplication) => {
  const projectRoot = path.join(process.cwd(), "..");
  const distPath = path.join(projectRoot, "back-office", "dist");

  if (!fs.existsSync(distPath)) {
    logger.warn(`back-office non construit (${distPath} absent) — /back-office ne sera pas servi.`);
    return;
  }

  // 1. Fichiers statiques (assets buildés par Vite, référencés sous /back-office/…).
  app.use(
    "/back-office",
    express.static(distPath, {
      index: false, // l'index est géré ci-dessous, pour le fallback SPA
      fallthrough: true,
    }),
  );

  // 2. Fallback SPA : toute route non-fichier sous /back-office rend index.html.
  app.use("/back-office", (_req: Request, res: Response, next: NextFunction) => {
    const indexPath = path.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      return next();
    }
    res.sendFile(indexPath);
  });

  logger.log(`Back-office servi depuis ${distPath} sur /back-office`);
};
