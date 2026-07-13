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
  categories: string[];
  thematiques: string[];
  niveauExpertise?: string;
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
  aIntegrerMec: "oui",
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

  describe("Curation", () => {
    it("ne propose que les services « À intégrer MEC = oui »", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "retenu", nom: "Retenu", classification: EAU }),
          service({ slug: "ecarte", nom: "Écarté", classification: EAU, aIntegrerMec: "non" }),
          service({ slug: "peut-etre", nom: "Peut-être", classification: EAU, aIntegrerMec: "eventuellement" }),
        ]);
      const projetId = await creerProjet(EAU);

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["retenu"]);
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

  describe("Fallback générique", () => {
    it("remonte les services transverses après les services pertinents", async () => {
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

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["pertinent", "transverse"]);
    });

    it("n'affiche QUE les services génériques pour un projet non classifié", async () => {
      // C'est ce qui évite qu'un projet fraîchement créé (job LLM pas encore passé) ne voie
      // aucun service du tout.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "cible", nom: "Ciblé", classification: EAU }),
          service({ slug: "transverse", nom: "Transverse", classification: EAU, presentationGenerique: "oui" }),
        ]);
      const projetId = await creerProjet(null);

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["transverse"]);
    });

    it("n'affiche jamais un service curé sans thématique ni fallback générique", async () => {
      // Cas réel du benchmark : « Boussole de la transition écologique » et « EnvErgo » sont
      // marqués « À intégrer MEC » mais n'ont ni thématique fine ni présentation générique.
      // Ce test documente qu'ils sont invisibles — c'est un défaut de DONNÉES, pas de code.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
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
      expect(charge).not.toContain("aIntegrerMec");
      expect(charge).not.toContain("presentationGenerique");
      expect(charge).not.toContain("score");
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
      expect(service0.thematiques).toEqual(["Gestion des eaux pluviales"]);
      expect(service0.redirection?.url).toContain("https://");
    });
  });
});
