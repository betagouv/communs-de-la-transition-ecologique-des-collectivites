import {
  construireCategories,
  construireClassification,
  construirePhases,
  normaliser,
  parserLigne,
  resoudreEtiquette,
  slugifier,
  ternaire,
} from "./parse-benchmark";

// Le benchmark est un fichier tenu à la main : apostrophes typographiques, séparateurs
// incohérents, casse variable, coquilles, libellés rangés dans le mauvais axe, ligne d'en-tête
// égarée au milieu des données. Ces tests pinnent chaque décision de normalisation — c'est là
// que se joue la qualité du matching en aval.

describe("normaliser", () => {
  it("ramène l'apostrophe typographique à l'apostrophe droite", () => {
    // Sans ça, « Filières agricoles à bas niveau d’impact » ne matche pas la taxonomie, qui
    // l'écrit avec une apostrophe droite — et le critère est perdu en silence.
    expect(normaliser("Filières agricoles à bas niveau d’impact")).toBe("Filières agricoles à bas niveau d'impact");
  });

  it("réduit espaces insécables et espaces multiples", () => {
    expect(normaliser("Gestion de   l'eau  ")).toBe("Gestion de l'eau");
  });
});

describe("resoudreEtiquette", () => {
  it("accepte une étiquette conforme à la taxonomie", () => {
    expect(resoudreEtiquette("Gestion des eaux pluviales", "thematiques")).toEqual({
      axe: "thematiques",
      label: "Gestion des eaux pluviales",
    });
  });

  it("tolère les écarts de forme, jamais les écarts de fond", () => {
    // L'apostrophe typographique et les espaces surnuméraires sont de la mise en forme :
    // on les normalise. Un libellé faux, lui, reste faux.
    expect(resoudreEtiquette("  Filières agricoles à bas niveau d’impact ", "thematiques").label).toBe(
      "Filières agricoles à bas niveau d'impact",
    );
  });

  it("LÈVE sur toute étiquette hors taxonomie, sans échappatoire", () => {
    // Le garde-fou central : les coquilles et les libellés mal rangés se corrigent DANS le
    // CSV (versionné, relu en PR), pas dans une couche de contournement. Un libellé qu'on
    // laisserait filer, c'est un critère de matching perdu sans témoin.
    expect(() => resoudreEtiquette("Réseau chaleur", "thematiques")).toThrow(
      /Étiquette inconnue.*benchmark-dinum\.csv/s,
    );
    expect(() => resoudreEtiquette("Sensibilisation", "thematiques")).toThrow(/Étiquette inconnue/);
  });

  it("refuse une étiquette valide MAIS rangée dans le mauvais axe", () => {
    // « Sensibilisation » est une modalité, « Voirie » une thématique. Les accepter dans le
    // mauvais axe, c'est fausser le score en silence.
    expect(() => resoudreEtiquette("Voirie", "sites")).toThrow(/axe « sites »/);
    expect(resoudreEtiquette("Voirie", "thematiques").label).toBe("Voirie");
    expect(resoudreEtiquette("Sensibilisation", "interventions").label).toBe("Sensibilisation");
  });
});

describe("construireClassification", () => {
  const vide = {
    thematiquesPrincipales: "",
    thematiquesSecondaires: "",
    lieuxPrincipaux: "",
    lieuxSecondaires: "",
    modalitesPrincipales: "",
    modalitesSecondaires: "",
  };

  it("note les étiquettes principales 1.0 et les secondaires 0.85", () => {
    const c = construireClassification({
      ...vide,
      thematiquesPrincipales: "Gestion des eaux pluviales",
      thematiquesSecondaires: "Voirie",
    });

    expect(c.thematiques).toEqual([
      { label: "Gestion des eaux pluviales", score: 1.0 },
      { label: "Voirie", score: 0.85 },
    ]);
  });

  it("découpe sur « / » comme sur « ; » (les deux séparateurs du fichier)", () => {
    const parSlash = construireClassification({ ...vide, lieuxPrincipaux: "Friche/Forêt" });
    const parPointVirgule = construireClassification({ ...vide, lieuxPrincipaux: "Friche;Forêt" });

    expect(parSlash.sites.map((s) => s.label)).toEqual(["Friche", "Forêt"]);
    expect(parPointVirgule.sites).toEqual(parSlash.sites);
  });

  it("ne rétrograde pas en secondaire une étiquette déjà posée en principale", () => {
    const c = construireClassification({
      ...vide,
      thematiquesPrincipales: "Voirie",
      thematiquesSecondaires: "Voirie",
    });

    expect(c.thematiques).toEqual([{ label: "Voirie", score: 1.0 }]);
  });
});

describe("construirePhases", () => {
  it("mappe les colonnes du benchmark vers les phases projet, Oui=1 / Un peu=0.5 / Non=0", () => {
    const phases = construirePhases({
      "Phase : Affiner un projet au stade de l’idée vague": "Oui",
      "Phase : Concrétiser un projet qui prend forme": "Un peu",
      "Gestion quotidienne et opérationnelle de la collectivité": "Non",
    });

    expect(phases).toEqual({ Idée: 1, Étude: 0.5, Opération: 0.5 });
  });

  it("retient le MAXIMUM quand deux colonnes contribuent à la même phase projet", () => {
    // « Opération » reçoit « Concrétiser » ET « Gestion quotidienne ».
    const phases = construirePhases({
      "Phase : Concrétiser un projet qui prend forme": "Non",
      "Gestion quotidienne et opérationnelle de la collectivité": "Oui",
    });

    expect(phases["Opération"]).toBe(1);
  });

  it("ignore les deux colonnes qui ne décrivent pas un projet mais la collectivité", () => {
    const phases = construirePhases({
      "Phase : Mieux saisir son territoire, décider des sujets prioritaires": "Oui",
      "Phase : Construire et suivre un plan global, agréger des indicateurs": "Oui",
    });

    expect(phases).toEqual({});
  });

  it("laisse une phase absente non renseignée plutôt que de la noter zéro", () => {
    // Donnée absente ≠ « Non » : un service ne doit pas être pénalisé pour une information
    // qu'on n'a pas (le benchmark n'est rempli qu'à 60 % sur ces colonnes).
    expect(construirePhases({})).toEqual({});
  });
});

describe("construireCategories", () => {
  it("cumule toutes les catégories cochées", () => {
    expect(
      construireCategories({
        "Services numériques experts": "Oui",
        "Aides financières": "Oui",
        "Base de contenu": "Non",
      }),
    ).toEqual(["expert", "aides"]);
  });

  it("accepte le « oui » en minuscule du fichier", () => {
    expect(construireCategories({ "Organiser le conseil": "oui" })).toEqual(["conseil"]);
  });
});

describe("ternaire", () => {
  it("normalise la casse et les accents", () => {
    expect(ternaire("Oui")).toBe("oui");
    expect(ternaire("oui")).toBe("oui");
    expect(ternaire("Éventuellement")).toBe("eventuellement");
  });

  it("renvoie null sur une valeur hors vocabulaire", () => {
    expect(ternaire("")).toBeNull();
    expect(ternaire("peut-être")).toBeNull();
  });
});

describe("slugifier", () => {
  it("produit l'identifiant stable exposé par l'API", () => {
    expect(slugifier("Boussole de la transition écologique")).toBe("boussole-de-la-transition-ecologique");
    expect(slugifier("Expertises-Territoires")).toBe("expertises-territoires");
  });
});

describe("parserLigne", () => {
  it("écarte la ligne d'en-tête égarée au milieu des données", () => {
    expect(parserLigne({ "Nom du service": "Nom du service" })).toBeNull();
  });

  it("écarte une ligne sans nom de service", () => {
    expect(parserLigne({ "Nom du service": "  " })).toBeNull();
  });
});
