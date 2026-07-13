import * as express from "express";
import * as path from "path";
import * as fs from "fs";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "@nestjs/common";

const logger = new Logger("ServeLogos");

/**
 * Sert les logos des services numériques, rapatriés dans le dépôt.
 *
 * Hébergés plutôt que hotlinkés : les URLs des partenaires bougent (celle de Zéro Logement
 * Vacant contient un hash de build), et une carte de service avec une image cassée est un
 * bug silencieux. Voir scripts/import-benchmark-dinum/fetch-logos.ts.
 *
 * Cache long : ces fichiers sont immuables entre deux exécutions de `pnpm logos:fetch`.
 */
export const serveLogos = (app: NestExpressApplication) => {
  const logosPath = path.join(process.cwd(), "public", "logos");

  if (!fs.existsSync(logosPath)) {
    logger.warn(`Logos introuvables à ${logosPath} — /logos ne sera pas servi`);
    return;
  }

  app.use(
    "/logos",
    express.static(logosPath, {
      maxAge: "7d",
      immutable: false,
      index: false,
    }),
  );

  logger.log(`Logos servis depuis ${logosPath}`);
};
