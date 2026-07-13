import fs from "fs";
import { parse } from "csv-parse/sync";

/**
 * Lit le benchmark, quel que soit son encodage.
 *
 * Le fichier est aujourd'hui en UTF-8 dans le dépôt : c'est la seule forme qu'on sache aussi
 * ÉCRIRE (Node ne fournit pas d'encodeur CP1252, seulement un décodeur), et sans ça le script
 * de classification ne pourrait pas réécrire ses propositions sans corrompre les accents.
 *
 * Mais l'original venait d'un export Excel français, donc en CP1252. Un ré-export par
 * quelqu'un qui ne connaît pas cette subtilité reviendrait en CP1252 — et un `0xe9` isolé
 * ferait exploser le décodage UTF-8. On renifle donc plutôt que d'imposer : UTF-8 d'abord,
 * repli CP1252. Coût nul, une classe de bugs en moins.
 */
export function lireBenchmark(chemin: string): Record<string, string>[] {
  const octets = fs.readFileSync(chemin);

  let texte: string;
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    texte = new TextDecoder("windows-1252").decode(octets);
  }

  return parse(texte, {
    columns: true,
    delimiter: ";",
    relax_quotes: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
}
