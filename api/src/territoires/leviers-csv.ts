import { leviers } from "@/shared/const/leviers";

// Leviers canoniques triés du plus long au plus court : on tente de consommer
// d'abord le libellé le plus long, ce qui évite qu'un levier préfixe d'un autre
// (ou contenant une virgule) soit mal découpé.
const SORTED_LEVIERS = [...leviers].sort((a, b) => b.length - a.length);

/**
 * Découpe la colonne CSV `leviersSgpe` en tableau de leviers.
 *
 * Un simple split sur "," est faux : au moins un levier canonique contient une
 * virgule (« Prévention des inondations par débordement de cours d'eau, notamment
 * via restauration des milieux aquatiques »). On consomme donc gloutonnement les
 * leviers canoniques en tête de chaîne, et on ne retombe sur un split par virgule
 * que pour les fragments ne correspondant à aucun levier connu.
 */
export function splitLeviersCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const result: string[] = [];
  let rest = raw.trim();

  while (rest.length > 0) {
    const canonical = SORTED_LEVIERS.find((levier) => rest === levier || rest.startsWith(`${levier},`));
    if (canonical) {
      result.push(canonical);
      rest = rest.slice(canonical.length).replace(/^\s*,\s*/, "");
      continue;
    }
    const idx = rest.indexOf(",");
    if (idx < 0) {
      result.push(rest.trim());
      break;
    }
    result.push(rest.slice(0, idx).trim());
    rest = rest.slice(idx + 1).trimStart();
  }

  return result.filter(Boolean);
}
