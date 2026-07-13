import fs from "fs";
import { join } from "path";
import { stringify } from "csv-stringify/sync";
import Anthropic from "@anthropic-ai/sdk";
import { normaliser } from "./parse-benchmark";
import { lireBenchmark } from "./lire-csv";

/**
 * Rédige baseline + descriptions pour les services du benchmark qui n'en ont pas, À PARTIR DU
 * CONTENU RÉEL DE LEUR PAGE D'ACCUEIL — et réécrit ses propositions dans le CSV.
 *
 * ANTI-HALLUCINATION. Ce n'est pas un réglage de modèle, c'est une contrainte de conception :
 *  1. le modèle ne voit QUE le texte extrait de la page (pas son propre savoir sur le service) ;
 *  2. il a une porte de sortie explicite — s'il juge la page inexploitable (site mort, page de
 *     connexion, texte trop pauvre), il répond `{"insuffisant": true, "raison": …}` au lieu
 *     d'inventer. Sans cette porte, un LLM sommé de décrire une page vide invente toujours ;
 *  3. une page qui ne rend pas 200, ou dont le texte utile est trop court, n'est même pas
 *     soumise au modèle.
 *
 * Le benchmark contient déjà des liens MORTS (FAVEUR répond 503, CONVA a migré) : ce sont
 * précisément les cas où une description inventée serait la plus nuisible — elle décrirait un
 * service qui n'existe plus, et une collectivité cliquerait dessus.
 *
 * Comme classify-services, le script écrit dans le CSV (donc relu en PR), jamais en base.
 *
 * Usage : ANTHROPIC_API_KEY=… pnpm describe:services
 */

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

/** En dessous, la page ne contient rien de descriptible (shell de SPA, page de login, 404 déguisée). */
const TEXTE_MINIMUM = 400;

const SYSTEM = `Tu rédiges des fiches de services numériques publics français, destinées à des agents de collectivités territoriales.

RÈGLE ABSOLUE : tu ne disposes QUE du texte de la page fourni. N'utilise RIEN d'autre — ni tes connaissances sur ce service, ni des suppositions sur ce qu'il « devrait » faire. Chaque affirmation doit être justifiable par le texte fourni.

Si le texte est inexploitable (page de connexion, coquille vide, message d'erreur, site en maintenance, ou trop pauvre pour dire ce que fait le service), réponds EXACTEMENT :
{"insuffisant": true, "raison": "<une phrase>"}

Sinon, réponds EXACTEMENT ce JSON, en français, sans texte autour :
{
  "nom": "<le nom du service tel qu'il apparaît sur la page — uniquement si le nom fourni est une URL ; sinon omets ce champ>",
  "baseline": "<accroche de 10 mots maximum>",
  "descriptionCourte": "<2 ou 3 phrases : ce que fait le service, pour qui, ce qu'il permet concrètement>",
  "descriptionLongue": "<1 à 3 paragraphes : le problème traité, comment le service y répond, ce qu'une collectivité peut en attendre>"
}

Écris pour un agent pressé : pas de jargon, pas de superlatif, pas de formule creuse. N'invente ni chiffre, ni partenaire, ni fonctionnalité qui ne figure pas dans le texte.`;

interface Redaction {
  /** Renseigné seulement quand le « nom » du benchmark est en fait une URL. */
  nom?: string;
  baseline: string;
  descriptionCourte: string;
  descriptionLongue: string;
}
interface Insuffisant {
  insuffisant: true;
  raison: string;
}

/**
 * Extrait le texte utile d'une page. Volontairement rustique (pas de dépendance HTML) : on
 * retire scripts et styles, on garde le titre, les métadonnées de description et le texte
 * visible. Le but n'est pas un rendu fidèle, c'est de donner au modèle de la matière VRAIE.
 */
function extraireTexte(html: string): string {
  const meta = (nom: string) => {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${nom}["'][^>]+content=["']([^"']+)["']`, "i");
    return re.exec(html)?.[1] ?? "";
  };

  const corps = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&(?:lt|gt|quot|#39|rsquo);/g, " ");

  return [/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "", meta("description"), meta("og:description"), corps]
    .map(normaliser)
    .filter(Boolean)
    .join("\n")
    .slice(0, 12_000); // large de quoi couvrir une page d'accueil, borné pour le coût
}

async function recupererPage(url: string): Promise<string | null> {
  try {
    const reponse = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!reponse.ok) return null;

    const texte = extraireTexte(await reponse.text());
    return texte.length >= TEXTE_MINIMUM ? texte : null;
  } catch {
    return null;
  }
}

async function rediger(anthropic: Anthropic, nom: string, url: string, page: string): Promise<Redaction | Insuffisant> {
  const reponse = await anthropic.messages.create({
    model: MODELE,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Service : ${nom}\nURL : ${url}\n\n--- TEXTE DE LA PAGE ---\n${page}`,
      },
    ],
  });

  const texte = reponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const json = /\{[\s\S]*\}/.exec(texte)?.[0];
  if (!json) throw new Error(`réponse non-JSON : ${texte.slice(0, 120)}`);

  return JSON.parse(json) as Redaction | Insuffisant;
}

/** Le nom du service est parfois lui-même une URL : le benchmark est à moitié rempli. */
function urlDuService(ligne: Record<string, string>): string | null {
  for (const brut of [ligne["Lien du service auto"], ligne["Nom du service"]]) {
    const v = normaliser(brut ?? "");
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[\w.-]+\.(fr|gouv\.fr|com|org|eu)(\/|$)/i.test(v)) return `https://${v}`;
  }
  return null;
}

function aBesoinDeDescription(ligne: Record<string, string>): boolean {
  const nom = normaliser(ligne["Nom du service"] ?? "");
  if (!nom || nom === "Nom du service") return false;

  const description = normaliser(ligne["Description courte auto"] ?? "") || normaliser(ligne["Description auto"] ?? "");
  return !description && urlDuService(ligne) !== null;
}

async function main(): Promise<void> {
  const chemin = join(__dirname, "benchmark-dinum.csv");
  const lignes = lireBenchmark(chemin);
  const aDecrire = lignes.filter(aBesoinDeDescription);

  console.log(`${lignes.length} services lus — ${aDecrire.length} sans description mais avec une URL.\n`);
  if (aDecrire.length === 0) return;

  const anthropic = new Anthropic();
  let rediges = 0;
  const ecartes: string[] = [];

  for (const ligne of aDecrire) {
    const nom = normaliser(ligne["Nom du service"]);
    const url = urlDuService(ligne)!;

    const page = await recupererPage(url);
    if (!page) {
      // Site mort, page de connexion, coquille de SPA. On ne décrit PAS : une description
      // inventée pour un lien mort est pire que pas de description du tout.
      ecartes.push(`${nom} — page inexploitable (${url})`);
      console.log(`  – ${nom} — page inexploitable, non décrite`);
      continue;
    }

    try {
      const r = await rediger(anthropic, nom, url, page);

      if ("insuffisant" in r) {
        ecartes.push(`${nom} — ${r.raison}`);
        console.log(`  – ${nom} — ${r.raison}`);
        continue;
      }

      // Quatre lignes du benchmark ont une URL en guise de nom de service. Sans ça, le
      // catalogue afficherait « https://la-banquise.com/ » comme nom.
      if (r.nom && /^https?:\/\//i.test(nom)) ligne["Nom du service"] = r.nom;

      ligne["Baseline auto"] = r.baseline;
      ligne["Description courte auto"] = r.descriptionCourte;
      ligne["Description auto"] = r.descriptionLongue;
      rediges++;
      console.log(`  ✓ ${nom}\n      ${r.descriptionCourte.slice(0, 110)}…`);
    } catch (e) {
      ecartes.push(`${nom} — ${(e as Error).message}`);
      console.error(`  ✗ ${nom} — ${(e as Error).message}`);
    }
  }

  fs.writeFileSync(
    chemin,
    stringify(lignes, { header: true, columns: Object.keys(lignes[0]), delimiter: ";" }),
    "utf8",
  );

  console.log(`\n✅ ${rediges} services décrits, CSV réécrit.`);
  if (ecartes.length > 0) {
    console.log(`\n⚠ ${ecartes.length} non décrits (aucune description inventée) :`);
    for (const e of ecartes) console.log(`    ${e}`);
  }
  console.log(
    `\n   Ce sont des PROPOSITIONS : relisez \`git diff\` avant de commiter,\n` +
      `   puis enchaînez \`pnpm classify:services\` et \`pnpm import:benchmark-dinum\`.`,
  );
}

main().catch((e) => {
  console.error(`\n❌ ${(e as Error).message}`);
  process.exit(1);
});
