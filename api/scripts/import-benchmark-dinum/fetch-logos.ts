import fs from "fs";
import { join } from "path";

/**
 * Rapatrie les logos des services numériques dans public/logos/services/.
 *
 * POURQUOI HÉBERGER PLUTÔT QUE HOTLINKER. Les logos des partenaires vivent sur leurs sites,
 * dont on ne maîtrise ni les refontes ni les URLs. Celle de Zéro Logement Vacant contient
 * déjà un hash de build (`zlv-BeNm-OSb.svg`) : elle cassera à leur prochain déploiement.
 * Hotlinker, c'est accepter que des cartes de service deviennent des images cassées sans
 * que personne ne s'en aperçoive. On copie donc une fois, et on sert nous-mêmes.
 *
 * La provenance est conservée dans logos-sources.json — pour pouvoir rafraîchir sans refaire
 * la recherche.
 */

interface Source {
  type: "service" | "operateur";
  url: string;
  note?: string;
}

const EXTENSIONS: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const DESTINATION = join(process.cwd(), "public", "logos", "services");

async function telecharger(slug: string, source: Source): Promise<string> {
  const reponse = await fetch(source.url, { redirect: "follow" });
  if (!reponse.ok) {
    throw new Error(`HTTP ${reponse.status}`);
  }

  const contentType = (reponse.headers.get("content-type") ?? "").split(";")[0].trim();
  const extension = EXTENSIONS[contentType];
  if (!extension) {
    // Un logo qui n'est pas une image, c'est une page d'erreur déguisée. On refuse plutôt
    // que d'écrire un fichier HTML avec une extension .png.
    throw new Error(`content-type inattendu : ${contentType || "(absent)"}`);
  }

  const octets = Buffer.from(await reponse.arrayBuffer());
  if (octets.length < 200) {
    throw new Error(`fichier suspect (${octets.length} octets)`);
  }

  const fichier = `${slug}.${extension}`;
  fs.writeFileSync(join(DESTINATION, fichier), octets);
  return `${fichier} (${contentType}, ${Math.round(octets.length / 1024)} ko)`;
}

async function main(): Promise<void> {
  const sources = JSON.parse(fs.readFileSync(join(__dirname, "logos-sources.json"), "utf8")) as Record<
    string,
    Source | string[]
  >;

  fs.mkdirSync(DESTINATION, { recursive: true });

  const echecs: string[] = [];
  let telecharges = 0;

  for (const [slug, source] of Object.entries(sources)) {
    if (slug.startsWith("_")) continue; // clé de documentation
    const s = source as Source;

    try {
      const resultat = await telecharger(slug, s);
      telecharges++;
      console.log(`  ✓ ${s.type === "operateur" ? "[opérateur] " : ""}${slug} → ${resultat}`);
    } catch (e) {
      echecs.push(`${slug} : ${(e as Error).message}`);
      console.log(`  ✗ ${slug} — ${(e as Error).message}`);
    }
  }

  console.log(`\n${telecharges} logos rapatriés dans public/logos/services/`);

  if (echecs.length > 0) {
    // Un logo manquant n'est pas fatal (la carte s'affichera sans image), mais il ne doit
    // pas passer inaperçu : c'est presque toujours une URL qui a bougé chez le partenaire.
    console.error(`\n⚠ ${echecs.length} échec(s) — l'URL a probablement bougé chez le partenaire :`);
    for (const e of echecs) console.error(`    ${e}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n❌ ${(e as Error).message}`);
  process.exit(1);
});
