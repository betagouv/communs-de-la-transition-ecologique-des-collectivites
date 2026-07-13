import fs from "fs";
import { join } from "path";
import { stringify } from "csv-stringify/sync";
import { NestFactory } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { ClassificationModule } from "@/projet-qualification/classification/classification.module";
import { ClassificationService } from "@/projet-qualification/classification/classification.service";
import { LoggerModule } from "@/logging/logger.module";
import { currentEnv } from "@/shared/utils/currentEnv";
import { normaliser } from "./parse-benchmark";
import { lireBenchmark } from "./lire-csv";

/**
 * Classifie sur les trois axes du schéma commun les services du benchmark qui ont une
 * DESCRIPTION mais aucune classification — et réécrit ses PROPOSITIONS dans le CSV.
 *
 * POURQUOI LE CLASSIFIEUR PLUTÔT QUE DES ÉTIQUETTES ÉCRITES À LA MAIN.
 * Le matching compare la classification d'un SERVICE à celle d'un PROJET, et celle du projet
 * est posée par ce classifieur-ci. Des étiquettes rédigées à la main ne seraient pas calibrées
 * de la même façon : les scores ne seraient pas commensurables et la pertinence serait faussée
 * de façon invisible. En passant par le même moteur, service et projet parlent la même langue.
 * Le classifieur valide en plus ses sorties contre les référentiels fermés (anti-hallucination
 * par distance de Levenshtein) : il ne peut pas inventer une étiquette.
 *
 * POURQUOI RÉÉCRIRE LE CSV PLUTÔT QUE LA BASE.
 * Une classification engage la pertinence de tout le catalogue. Écrite directement en base,
 * elle serait invisible, jamais relue, et écrasée au prochain import (qui fait un upsert depuis
 * le CSV). Écrite dans le CSV, elle passe par une revue de PR — on voit ce que le LLM a proposé
 * AVANT que ça n'atteigne les collectivités — et l'import reste le seul écrivain de la table.
 *
 * Ce script ne fait qu'une PROPOSITION : relire `git diff` avant de commiter.
 *
 * Usage : ANTHROPIC_API_KEY=… pnpm classify:services
 */

// Le LLM rend des scores continus ; le CSV ne connaît que « principal » et « secondaire »
// (que l'import note ensuite 1.0 et 0.85). On tranche donc ici. Le seuil principal est celui
// du moteur de matching (0.8) : en dessous, l'étiquette ne compterait de toute façon pas.
const SEUIL_PRINCIPAL = 0.8;
const SEUIL_SECONDAIRE = 0.5;

const COLONNES = {
  thematiques: ["Thématiques principales", "Thématiques secondaires"],
  sites: ["Lieux principaux", "Lieux secondaires"],
  interventions: ["Modalités principales", "Modalités secondaires"],
} as const;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: `.env.${currentEnv}` }),
    LoggerModule,
    ClassificationModule,
  ],
})
class ClassifyServicesModule {}

interface Etiquette {
  label: string;
  score: number;
}

/** Le parseur découpe sur « / » comme sur « ; » — on écrit avec « / », le séparateur majoritaire. */
function repartir(labels: Etiquette[]): [principales: string, secondaires: string] {
  return [
    labels
      .filter((l) => l.score >= SEUIL_PRINCIPAL)
      .map((l) => l.label)
      .join("/"),
    labels
      .filter((l) => l.score >= SEUIL_SECONDAIRE && l.score < SEUIL_PRINCIPAL)
      .map((l) => l.label)
      .join("/"),
  ];
}

function aBesoinDeClassification(ligne: Record<string, string>): boolean {
  const nom = normaliser(ligne["Nom du service"] ?? "");
  if (!nom || nom === "Nom du service") return false;

  const description = normaliser(ligne["Description courte auto"] ?? "") || normaliser(ligne["Description auto"] ?? "");
  if (!description) return false;

  // On ne touche jamais à une classification existante : elle a été posée à la main ou déjà
  // relue. Le script ne comble que les trous.
  return !Object.values(COLONNES)
    .flat()
    .some((colonne) => normaliser(ligne[colonne] ?? "").length > 0);
}

async function main(): Promise<void> {
  const chemin = join(__dirname, "benchmark-dinum.csv");
  const lignes = lireBenchmark(chemin);
  const aClasser = lignes.filter(aBesoinDeClassification);

  console.log(`${lignes.length} services lus — ${aClasser.length} ont une description mais aucune classification.\n`);
  if (aClasser.length === 0) return;

  const app = await NestFactory.createApplicationContext(ClassifyServicesModule, { logger: false });
  const classification = app.get(ClassificationService);

  let classes = 0;
  try {
    for (const ligne of aClasser) {
      const nom = normaliser(ligne["Nom du service"]);
      const contexte = [
        nom,
        normaliser(ligne["Baseline auto"] ?? ""),
        normaliser(ligne["Description courte auto"] ?? "") || normaliser(ligne["Description auto"] ?? ""),
      ]
        .filter(Boolean)
        .join("\n");

      try {
        // type « aide » : un service de catalogue est un objet qu'on fait CORRESPONDRE à un
        // projet, il n'est pas lui-même un projet. Même cas de figure qu'une aide — donc pas
        // d'enrichissement projet, et pas de filtrage par seuil côté LLM (on tranche ici).
        const r = await classification.classify(contexte, "aide");

        for (const [axe, [colPrincipale, colSecondaire]] of Object.entries(COLONNES)) {
          const [principales, secondaires] = repartir(r[axe as keyof typeof COLONNES] as Etiquette[]);
          ligne[colPrincipale] = principales;
          ligne[colSecondaire] = secondaires;
        }

        const resume = Object.values(COLONNES)
          .map(([principale]) => ligne[principale])
          .filter(Boolean)
          .join(" · ");
        console.log(`  ✓ ${nom}\n      ${resume || "⚠ aucune étiquette au-dessus du seuil — restera invisible"}`);
        classes++;
      } catch (e) {
        console.error(`  ✗ ${nom} — ${(e as Error).message}`);
      }
    }
  } finally {
    await app.close();
  }

  // UTF-8 : c'est le seul encodage que Node sache écrire (il n'offre qu'un décodeur CP1252,
  // pas d'encodeur). Le lecteur, lui, accepte les deux — cf. lire-csv.ts.
  fs.writeFileSync(
    chemin,
    stringify(lignes, { header: true, columns: Object.keys(lignes[0]), delimiter: ";" }),
    "utf8",
  );

  console.log(
    `\n✅ ${classes} services classifiés, CSV réécrit.\n` +
      `   Ce sont des PROPOSITIONS : relisez \`git diff\` avant de commiter,\n` +
      `   puis rejouez \`pnpm import:benchmark-dinum\`.`,
  );
}

main().catch((e) => {
  console.error(`\n❌ ${(e as Error).message}`);
  process.exit(1);
});
