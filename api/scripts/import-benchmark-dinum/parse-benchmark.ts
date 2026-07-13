import { interventions } from "@/projet-qualification/classification/const/interventions";
import { sites } from "@/projet-qualification/classification/const/sites";
import { thematiques } from "@/projet-qualification/classification/const/thematiques";
import { AideClassification } from "@/aides/dto/aides.dto";
import {
  CATEGORIES,
  COLONNES_PHASE,
  NIVEAUX_EXPERTISE,
  POIDS_PHASE,
  TERNAIRES,
  type Categorie,
  type NiveauExpertise,
  type PoidsParPhase,
  type Ternaire,
} from "@/services-numeriques/service-numerique-contract";

export type Axe = "thematiques" | "sites" | "interventions";

export interface ServiceImporte {
  slug: string;
  nom: string;
  baseline: string | null;
  description: string | null;
  descriptionLongue: string | null;
  logoUrl: string | null;
  operateur: string | null;
  redirectionUrl: string | null;
  categories: Categorie[];
  niveauExpertise: NiveauExpertise | null;
  thematiquePrincipale: string | null;
  profilGeneraliste: Ternaire | null;
  presentationGenerique: Ternaire | null;
  classification: AideClassification;
  phases: PoidsParPhase;
  nature: string | null;
  beta: boolean | null;
  ecosystemePublic: boolean | null;
}

/**
 * Normalise une cellule : apostrophes typographiques, espaces multiples, espaces insécables.
 * Sans ça, « Filières agricoles à bas niveau d’impact » (U+2019) ne matche pas la taxonomie,
 * qui l'écrit avec une apostrophe droite — et le critère est perdu en silence.
 */
export function normaliser(valeur: string): string {
  return valeur
    .normalize("NFC")
    .replace(/[\u2019\u02BC]/g, "'") // apostrophes typographiques
    .replace(/\u00a0/g, " ") // espace insécable
    .replace(/\s+/g, " ")
    .trim();
}

/** Le benchmark mélange « / » et « ; » comme séparateurs multivalués, selon les cellules. */
function decouper(cellule: string): string[] {
  return cellule
    .split(/[/;]/)
    .map(normaliser)
    .filter((v) => v.length > 0);
}

const REFERENTIELS: Record<Axe, ReadonlySet<string>> = {
  thematiques: new Set(thematiques.map(normaliser)),
  sites: new Set(sites.map(normaliser)),
  interventions: new Set(interventions.map(normaliser)),
};

export interface EtiquetteResolue {
  axe: Axe;
  label: string;
}

/**
 * Résout une étiquette du benchmark vers une étiquette de taxonomie.
 *
 * Aucune indulgence : tout libellé absent de la taxonomie fait ÉCHOUER l'import. Les
 * coquilles et les libellés mal rangés se corrigent DANS le fichier (il est versionné dans
 * le dépôt et relu en PR), pas dans une couche de contournement qui masquerait durablement
 * la dette. Un libellé qu'on laisserait filer, c'est un critère de matching perdu et un
 * service qui ne remonte plus, sans témoin.
 */
export function resoudreEtiquette(brut: string, axe: Axe): EtiquetteResolue {
  const label = normaliser(brut);
  if (REFERENTIELS[axe].has(label)) return { axe, label };

  throw new Error(
    `Étiquette inconnue pour l'axe « ${axe} » : ${JSON.stringify(label)}. ` +
      `Corrigez le libellé dans scripts/import-benchmark-dinum/benchmark-dinum.csv — ` +
      `il doit appartenir à la taxonomie fermée du schéma commun ` +
      `(src/projet-qualification/classification/const/${axe}.ts).`,
  );
}

/**
 * Classification d'un service sur les trois axes.
 *
 * Le benchmark distingue « principales » et « secondaires » sans porter de score. On mappe
 * principal → 1.0 et secondaire → 0.85 : les deux restent au-dessus du seuil de confiance de
 * 0.8 du moteur de matching (donc les deux comptent), mais une étiquette principale pèse plus.
 */
export function construireClassification(cellules: {
  thematiquesPrincipales: string;
  thematiquesSecondaires: string;
  lieuxPrincipaux: string;
  lieuxSecondaires: string;
  modalitesPrincipales: string;
  modalitesSecondaires: string;
}): AideClassification {
  const classification: AideClassification = { thematiques: [], sites: [], interventions: [] };
  const vus = new Set<string>();

  const ajouter = (cellule: string, axe: Axe, score: number) => {
    for (const brut of decouper(cellule)) {
      const { label } = resoudreEtiquette(brut, axe);

      // Une étiquette déjà posée en « principale » ne doit pas être rétrogradée par sa
      // reprise en « secondaire ».
      const cle = `${axe}:${label}`;
      if (vus.has(cle)) continue;
      vus.add(cle);

      classification[axe].push({ label, score });
    }
  };

  ajouter(cellules.thematiquesPrincipales, "thematiques", 1.0);
  ajouter(cellules.lieuxPrincipaux, "sites", 1.0);
  ajouter(cellules.modalitesPrincipales, "interventions", 1.0);
  ajouter(cellules.thematiquesSecondaires, "thematiques", 0.85);
  ajouter(cellules.lieuxSecondaires, "sites", 0.85);
  ajouter(cellules.modalitesSecondaires, "interventions", 0.85);

  return classification;
}

/** « Oui » / « oui » / « Éventuellement » → valeur ternaire normalisée. */
export function ternaire(valeur: string): Ternaire | null {
  const v = normaliser(valeur)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // retire les accents : « éventuellement » → « eventuellement »
  return (TERNAIRES as readonly string[]).includes(v) ? (v as Ternaire) : null;
}

/** Poids par phase projet : maximum des colonnes du benchmark qui y contribuent. */
export function construirePhases(ligne: Record<string, string>): PoidsParPhase {
  const phases: PoidsParPhase = {};

  for (const [colonne, phasesProjet] of Object.entries(COLONNES_PHASE)) {
    const poids = POIDS_PHASE[normaliser(ligne[colonne] ?? "").toLowerCase()];
    if (poids === undefined) continue;

    for (const phase of phasesProjet) {
      phases[phase] = Math.max(phases[phase] ?? 0, poids);
    }
  }
  return phases;
}

/** Les 6 colonnes « Structure une… » du benchmark → catégories exposées. */
const COLONNES_CATEGORIE: Record<string, Categorie> = {
  "Services numériques experts": "expert",
  "Base de contenu": "contenu",
  "Base de projets inspirants": "inspirants",
  "Discussions entre pairs, forum, communauté": "discussions",
  "Organiser le conseil": "conseil",
  "Aides financières": "aides",
};

export function construireCategories(ligne: Record<string, string>): Categorie[] {
  const categories = Object.entries(COLONNES_CATEGORIE)
    .filter(([colonne]) => ternaire(ligne[colonne] ?? "") === "oui")
    .map(([, categorie]) => categorie);

  return CATEGORIES.filter((c) => categories.includes(c));
}

export function slugifier(nom: string): string {
  return normaliser(nom)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function texte(valeur: string | undefined): string | null {
  const v = normaliser(valeur ?? "");
  return v.length > 0 ? v : null;
}

function booleen(valeur: string | undefined): boolean | null {
  const t = ternaire(valeur ?? "");
  return t === "oui" ? true : t === "non" ? false : null;
}

function niveau(valeur: string | undefined): NiveauExpertise | null {
  const v = normaliser(valeur ?? "").toLowerCase();
  return (NIVEAUX_EXPERTISE as readonly string[]).includes(v) ? (v as NiveauExpertise) : null;
}

/**
 * Une ligne du CSV → un service.
 *
 * Retourne `null` pour les lignes à écarter : lignes sans nom de service, et ligne d'en-tête
 * répétée au milieu des données (retirée du fichier, mais la garde reste : c'est un artefact
 * classique d'un ré-export depuis un tableur).
 */
export function parserLigne(ligne: Record<string, string>): ServiceImporte | null {
  const nom = texte(ligne["Nom du service"]);
  if (!nom || nom === "Nom du service") return null;

  return {
    slug: slugifier(nom),
    nom,
    baseline: texte(ligne["Baseline auto"]),
    description: texte(ligne["Description courte auto"]),
    descriptionLongue: texte(ligne["Description auto"]),
    logoUrl: texte(ligne.Logo),
    operateur: texte(ligne["Opérateur"]),
    redirectionUrl: texte(ligne["Lien du service auto"]),
    categories: construireCategories(ligne),
    niveauExpertise: niveau(ligne["Niveau d’expertise technique"]),
    thematiquePrincipale: texte(ligne["Thématique principale"]),
    // La colonne du benchmark s'appelle encore « A intégrer MEC » — c'est la donnée du
    // partenaire, on ne la renomme pas chez lui. Mais chez nous elle décrit une propriété du
    // SERVICE (utilisable par un non-spécialiste ?), pas une décision sur MEC : c'est ce
    // renommage qui autorise à l'exposer sans faire traverser un critère de sélection.
    profilGeneraliste: ternaire(ligne["A intégrer MEC"] ?? ""),
    presentationGenerique: ternaire(ligne["À présenter dans une présentation générique et peu contextualisée ?"] ?? ""),
    classification: construireClassification({
      thematiquesPrincipales: ligne["Thématiques principales"] ?? "",
      thematiquesSecondaires: ligne["Thématiques secondaires"] ?? "",
      lieuxPrincipaux: ligne["Lieux principaux"] ?? "",
      lieuxSecondaires: ligne["Lieux secondaires"] ?? "",
      modalitesPrincipales: ligne["Modalités principales"] ?? "",
      modalitesSecondaires: ligne["Modalités secondaires"] ?? "",
    }),
    phases: construirePhases(ligne),
    nature: texte(ligne.Nature),
    beta: booleen(ligne["Beta ?"]),
    ecosystemePublic: booleen(ligne["Ecosystème public"]),
  };
}
