import { eq } from "drizzle-orm";
import { AideClassification } from "@/aides/dto/aides.dto";
import { collectivites, projets, servicesNumeriques } from "@database/schema";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { createApiClient } from "@test/helpers/api-client";
import { E2E_BASE_URL } from "@test/helpers/e2e-port";

const BASE_URL = E2E_BASE_URL;

interface Service {
  id: string;
  nom: string;
  description: string;
  logoUrl?: string;
  categories: string[];
  niveauExpertise?: string;
  profilGeneraliste?: boolean;
  redirection?: { url: string; libelle?: string };
}
interface CorpsServices {
  services: Service[];
  message?: string;
}

const appeler = async <T>(chemin: string, apiKey = process.env.MEC_API_KEY): Promise<{ status: number; body: T }> => {
  const r = await fetch(`${BASE_URL}${chemin}`, {
    headers: { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), "Content-Type": "application/json" },
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as T };
};

const getServices = async (projetId: string): Promise<Service[]> =>
  (await appeler<CorpsServices>(`/projets/${projetId}/services`)).body.services;

/** Fabrique une ligne de catalogue. Par défaut : curée, non générique, sans phase. */
const service = (over: Partial<typeof servicesNumeriques.$inferInsert> & { slug: string; nom: string }) => ({
  description: `Description de ${over.nom}`,
  redirectionUrl: `https://exemple.gouv.fr/${over.slug}`,
  categories: ["expert"],
  profilGeneraliste: "oui",
  presentationGenerique: "non",
  classification: { thematiques: [], sites: [], interventions: [] } as AideClassification,
  phases: {},
  ...over,
});

const EAU: AideClassification = {
  thematiques: [{ label: "Gestion des eaux pluviales", score: 1 }],
  sites: [],
  interventions: [],
};
const VELO: AideClassification = {
  thematiques: [{ label: "Vélo (mobilité douce)", score: 1 }],
  sites: [],
  interventions: [],
};

describe("Services numériques (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY);

  const creerProjet = async (classification: AideClassification | null, phase?: "Idée" | "Étude" | "Opération") => {
    const { data } = await api.projets.create(mockProjetPayload());
    const projetId = (data as { id: string }).id;
    await global.testDbService.database
      .update(projets)
      .set({ classificationScores: classification, ...(phase ? { phase } : {}) })
      .where(eq(projets.id, projetId));
    return projetId;
  };

  beforeEach(async () => {
    await global.testDbService.database.insert(collectivites).values({
      type: mockedDefaultCollectivite.type,
      codeInsee: mockedDefaultCollectivite.code,
      nom: "Commune 1",
    });
  });

  afterEach(async () => {
    await global.testDbService.cleanDatabase();
  });

  describe("Catalogue", () => {
    it("propose TOUS les services qui scorent, sans verrou de curation", async () => {
      // Il n'y a plus de gate « À intégrer MEC » : profilGeneraliste ne décide plus de rien
      // côté serveur, c'est le score seul qui sélectionne.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "generaliste", nom: "Généraliste", classification: EAU, profilGeneraliste: "oui" }),
          service({ slug: "expert-pointu", nom: "Expert pointu", classification: EAU, profilGeneraliste: "non" }),
          service({ slug: "inconnu", nom: "Non renseigné", classification: EAU, profilGeneraliste: null }),
        ]);
      const projetId = await creerProjet(EAU);

      expect((await getServices(projetId)).map((s) => s.id).sort()).toEqual([
        "expert-pointu",
        "generaliste",
        "inconnu",
      ]);
    });

    it("expose profilGeneraliste pour que le client puisse filtrer", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "generaliste", nom: "Généraliste", classification: EAU, profilGeneraliste: "oui" }),
          service({ slug: "expert-pointu", nom: "Expert pointu", classification: EAU, profilGeneraliste: "non" }),
        ]);
      const projetId = await creerProjet(EAU);

      const parId = new Map((await getServices(projetId)).map((s) => [s.id, s]));

      expect(parId.get("generaliste")!.profilGeneraliste).toBe(true);
      expect(parId.get("expert-pointu")!.profilGeneraliste).toBe(false);
    });

    it("distingue « pas un profil généraliste » de « on n'en sait rien »", async () => {
      // 51 lignes sur 125 ne renseignent pas la colonne. Confondre l'absence d'information
      // avec un « non » ferait disparaître ces services d'un filtre légitime.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "inconnu", nom: "Non renseigné", classification: EAU, profilGeneraliste: null })]);
      const projetId = await creerProjet(EAU);

      expect((await getServices(projetId))[0].profilGeneraliste).toBeUndefined();
    });

    it("exige une clé d'API valide", async () => {
      const projetId = await creerProjet(EAU);

      expect((await appeler(`/projets/${projetId}/services`, "mauvaise-cle")).status).toBe(401);
    });

    it("renvoie une liste vide (200) quand le catalogue est vide", async () => {
      const projetId = await creerProjet(EAU);

      const { status, body } = await appeler<CorpsServices>(`/projets/${projetId}/services`);

      expect(status).toBe(200);
      expect(body.services).toEqual([]);
    });
  });

  describe("Pertinence", () => {
    it("retient un service dont la thématique recoupe celle du projet, écarte les autres", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "eau", nom: "Service eau", classification: EAU }),
          service({ slug: "velo", nom: "Service vélo", classification: VELO }),
        ]);
      const projetId = await creerProjet(EAU);

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["eau"]);
    });

    it("trie par pertinence décroissante", async () => {
      const partiel: AideClassification = {
        thematiques: [
          { label: "Gestion des eaux pluviales", score: 1 },
          { label: "Voirie", score: 1 },
        ],
        sites: [],
        interventions: [],
      };
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "partiel", nom: "Recouvre une thématique", classification: EAU }),
          service({ slug: "total", nom: "Recouvre les deux", classification: partiel }),
        ]);
      const projetId = await creerProjet(partiel);

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["total", "partiel"]);
    });
  });

  describe("Phase", () => {
    it("fait descendre un service mal phasé sans l'exclure", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "bien-phase", nom: "Bien phasé", classification: EAU, phases: { Idée: 1 } }),
          service({ slug: "mal-phase", nom: "Mal phasé", classification: EAU, phases: { Idée: 0 } }),
        ]);
      const projetId = await creerProjet(EAU, "Idée");

      // Les deux restent proposés : la phase module l'ordre, elle ne filtre pas.
      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["bien-phase", "mal-phase"]);
    });
  });

  describe("Aucun repêchage", () => {
    it("n'affiche PAS un service transverse sans recouvrement, même marqué « présentation générique »", async () => {
      // Le benchmark marque certains services « à présenter dans une présentation générique et
      // peu contextualisée » : c'est utile pour une page VITRINE, où il n'y a pas de contexte.
      // Une fiche projet est l'exact opposé — elle EST le contexte. Les faire remonter ici noyait
      // 4 services parfaitement ciblés sous 50 sans rapport avec le projet.
      await global.testDbService.database.insert(servicesNumeriques).values([
        service({ slug: "pertinent", nom: "Pertinent", classification: EAU }),
        service({
          slug: "transverse",
          nom: "Transverse",
          classification: VELO, // aucun recouvrement avec le projet
          presentationGenerique: "oui",
        }),
      ]);
      const projetId = await creerProjet(EAU);

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["pertinent"]);
    });

    it("renvoie une liste VIDE pour un projet non classifié", async () => {
      // Le job LLM n'a pas tourné : on ne sait rien de ce projet, on n'a donc rien à en dire.
      // Remplir l'écran ferait passer une donnée manquante pour un résultat.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "transverse", nom: "Transverse", classification: EAU, presentationGenerique: "oui" }),
        ]);
      const projetId = await creerProjet(null);

      expect(await getServices(projetId)).toEqual([]);
    });

    it("renvoie une liste VIDE quand le catalogue n'a rien pour ce projet", async () => {
      // Cas réel : un projet de salle des fêtes. Aucun service numérique du benchmark ne traite
      // ce type de lieu. Zéro service est la bonne réponse — et une information en soi.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "velo", nom: "Vélo", classification: VELO })]);
      const projetId = await creerProjet(EAU);

      expect(await getServices(projetId)).toEqual([]);
    });

    it("n'affiche jamais un service sans thématique", async () => {
      // Cas réel du benchmark : 11 lignes n'ont aucune classification. Elles scorent zéro à
      // jamais et resteront invisibles. C'est un défaut de DONNÉES, pas de code — et il ne se
      // rattrape pas par une règle d'affichage.
      await global.testDbService.database.insert(servicesNumeriques).values([
        service({
          slug: "invisible",
          nom: "Invisible",
          classification: { thematiques: [], sites: [], interventions: [] },
        }),
      ]);
      const projetId = await creerProjet(EAU);

      expect(await getServices(projetId)).toEqual([]);
    });
  });

  describe("Logos", () => {
    it("rend absolue l'URL d'un logo hébergé par l'API", async () => {
      // En base, le logo est un chemin relatif : le catalogue ne connaît pas le domaine sur
      // lequel il tourne. S'il sortait tel quel, MEC le chercherait sur SON propre domaine.
      await global.testDbService.database.insert(servicesNumeriques).values([
        service({
          slug: "benefriches",
          nom: "Bénéfriches",
          classification: EAU,
          logoUrl: "/logos/services/benefriches.svg",
        }),
      ]);
      const projetId = await creerProjet(EAU);

      const [s] = await getServices(projetId);

      expect(s.logoUrl).toBe(`${BASE_URL}/logos/services/benefriches.svg`);
    });

    it("sert effectivement le fichier de logo", async () => {
      const reponse = await fetch(`${BASE_URL}/logos/services/benefriches.svg`);

      expect(reponse.status).toBe(200);
      expect(reponse.headers.get("content-type")).toContain("image/svg+xml");
    });

    it("n'invente pas de logo pour un service qui n'en a pas", async () => {
      // Quatre services curés (Boussole, EnvErgo, Potentiel, portail ENR) ont une marque
      // purement typographique : aucun logo n'existe. Le champ doit être absent, pas rempli
      // d'un favicon ou d'une Marianne générique.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "envergo", nom: "EnvErgo", classification: EAU, logoUrl: null })]);
      const projetId = await creerProjet(EAU);

      const [s] = await getServices(projetId);

      expect(s.logoUrl).toBeUndefined();
    });
  });

  describe("Contrat exposé", () => {
    it("n'expose aucun critère de sélection ni de curation", async () => {
      await global.testDbService.database.insert(servicesNumeriques).values([
        service({
          slug: "boussole",
          nom: "Boussole",
          classification: EAU,
          phases: { Idée: 1 },
          presentationGenerique: "oui",
        }),
      ]);
      const projetId = await creerProjet(EAU);

      const { body } = await appeler<CorpsServices>(`/projets/${projetId}/services`);
      const charge = JSON.stringify(body);

      expect(charge).not.toContain("classification");
      expect(charge).not.toContain("phases");
      expect(charge).not.toContain("presentationGenerique");
      expect(charge).not.toContain("score");
      // `thematiques` était le critère de sélection, exposé sous forme de libellés — le contrat se
      // contredisait lui-même. Un client qui l'aurait affiché aurait montré à une collectivité les
      // entrailles du moteur, et non une information sur le service.
      expect(charge).not.toContain("thematiques");
    });

    it("projette les champs d'affichage attendus par MEC", async () => {
      await global.testDbService.database.insert(servicesNumeriques).values([
        service({
          slug: "boussole-de-la-transition-ecologique",
          nom: "Boussole de la transition écologique",
          baseline: "Un outil pour améliorer l'impact environnemental de vos projets",
          operateur: "CGDD",
          niveauExpertise: "bas",
          categories: ["contenu", "expert"],
          classification: EAU,
        }),
      ]);
      const projetId = await creerProjet(EAU);

      const [service0] = await getServices(projetId);

      expect(service0.id).toBe("boussole-de-la-transition-ecologique");
      expect(service0.categories).toEqual(["contenu", "expert"]);
      expect(service0.niveauExpertise).toBe("bas");
      expect(service0.redirection?.url).toContain("https://");
    });
  });
});
