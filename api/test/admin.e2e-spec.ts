import { eq } from "drizzle-orm";
import { AideClassification } from "@/aides/dto/aides.dto";
import { collectivites, projets, servicesNumeriques } from "@database/schema";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { createApiClient } from "@test/helpers/api-client";
import { E2E_BASE_URL } from "@test/helpers/e2e-port";

const SALLE: AideClassification = {
  thematiques: [],
  sites: [{ label: "Salle des fêtes, salle associative, pôle musical", score: 0.95 }],
  interventions: [{ label: "Construction bâtiment", score: 0.9 }],
};
const EAU: AideClassification = {
  thematiques: [{ label: "Gestion des eaux pluviales", score: 1 }],
  sites: [],
  interventions: [],
};

const Q_ESPACES = "part-estimee-des-espaces-exterieurs";
const RECO_HAIES = "questionnaire:atoutbiodiv-salle:haies";

const appeler = async <T>(
  methode: "GET" | "POST",
  chemin: string,
  body?: unknown,
  cle = process.env.SERVICE_MANAGEMENT_API_KEY,
): Promise<{ status: number; body: T }> => {
  const r = await fetch(`${E2E_BASE_URL}${chemin}`, {
    method: methode,
    headers: { ...(cle ? { Authorization: `Bearer ${cle}` } : {}), "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as T };
};

describe("Back-office (e2e)", () => {
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

  describe("Authentification", () => {
    it("exige la clé d'ADMINISTRATION, pas une clé de plateforme partenaire", async () => {
      // Ces endpoints exposent délibérément ce que le contrat public cache (conditions,
      // classifications, curation). Une clé MEC ne doit surtout pas y donner accès.
      expect((await appeler("GET", "/admin/contenu", undefined, process.env.MEC_API_KEY)).status).toBe(401);
      expect((await appeler("GET", "/admin/contenu", undefined, "mauvaise-cle")).status).toBe(401);
      expect((await appeler("GET", "/admin/contenu")).status).toBe(200);
    });
  });

  describe("GET /admin/contenu", () => {
    it("expose les conditions et la classification d'éligibilité — l'inverse du contrat public", async () => {
      const { body } = await appeler<{
        questionnaires: {
          slug: string;
          classification: AideClassification;
          recommandations: { condition: unknown }[];
        }[];
        seuils: { eligibilite: number; pertinence: number };
      }>("GET", "/admin/contenu");

      const salle = body.questionnaires.find((q) => q.slug === "atoutbiodiv-salle")!;

      expect(salle.classification.sites.map((s) => s.label)).toContain(
        "Salle des fêtes, salle associative, pôle musical",
      );
      expect(salle.recommandations.every((r) => r.condition !== undefined)).toBe(true);
      expect(body.seuils.eligibilite).toBeGreaterThan(0);
    });
  });

  describe("POST /admin/simuler", () => {
    it("simule sur un projet RÉEL et renvoie TOUS les candidats, y compris sous le seuil", async () => {
      const projetId = await creerProjet(SALLE);

      const { status, body } = await appeler<{
        questionnaires: { slug: string; score: number; retenu: boolean }[];
      }>("POST", "/admin/simuler", { projetId });

      expect(status).toBe(200);
      // Les 4 questionnaires sont rendus, pas seulement le retenu : sans la distribution
      // complète, on ne peut pas régler le seuil.
      expect(body.questionnaires).toHaveLength(4);

      const retenus = body.questionnaires.filter((q) => q.retenu);
      expect(retenus.map((q) => q.slug)).toEqual(["atoutbiodiv-salle"]);
      expect(body.questionnaires.every((q) => typeof q.score === "number")).toBe(true);
    });

    it("explique le score par les étiquettes partagées avec le projet", async () => {
      const projetId = await creerProjet(SALLE);

      const { body } = await appeler<{
        questionnaires: { slug: string; etiquettesCommunes: { sites: string[] } }[];
      }>("POST", "/admin/simuler", { projetId });

      const salle = body.questionnaires.find((q) => q.slug === "atoutbiodiv-salle")!;

      // Un score de 0,9 sans justification est un chiffre opaque. C'est ça qui le rend actionnable.
      expect(salle.etiquettesCommunes.sites).toContain("Salle des fêtes, salle associative, pôle musical");
    });

    it("simule l'effet de réponses SANS les enregistrer", async () => {
      const projetId = await creerProjet(SALLE);

      const { body } = await appeler<{
        questionnaires: { slug: string; statut: string; recommandations: { id: string; declenchee: boolean }[] }[];
      }>("POST", "/admin/simuler", {
        projetId,
        reponses: { "atoutbiodiv-salle": { [Q_ESPACES]: "importante-plus-de-50" } },
      });

      const salle = body.questionnaires.find((q) => q.slug === "atoutbiodiv-salle")!;
      expect(salle.statut).toBe("en_cours");
      expect(salle.recommandations.find((r) => r.id === RECO_HAIES)!.declenchee).toBe(true);

      // Le vrai endpoint public, lui, ne voit AUCUNE réponse : la simulation n'a rien écrit.
      const reel = await fetch(`${E2E_BASE_URL}/projets/${projetId}/questionnaires`, {
        headers: { Authorization: `Bearer ${process.env.MEC_API_KEY}` },
      });
      const { questionnaires } = (await reel.json()) as { questionnaires: { reponses: object }[] };
      expect(questionnaires[0].reponses).toEqual({});
    });

    it("distingue « pertinent » de « remonté en fallback générique »", async () => {
      await global.testDbService.database.insert(servicesNumeriques).values([
        {
          slug: "pertinent",
          nom: "Pertinent",
          classification: EAU,
          phases: {},
          categories: [],
          presentationGenerique: "non",
        },
        {
          slug: "transverse",
          nom: "Transverse",
          classification: { thematiques: [], sites: [], interventions: [] },
          phases: {},
          categories: [],
          presentationGenerique: "oui",
        },
      ]);
      const projetId = await creerProjet(EAU);

      const { body } = await appeler<{ services: { slug: string; motif: string; retenu: boolean }[] }>(
        "POST",
        "/admin/simuler",
        { projetId },
      );

      const parSlug = new Map(body.services.map((s) => [s.slug, s]));
      expect(parSlug.get("pertinent")!.motif).toBe("pertinence");
      expect(parSlug.get("transverse")!.motif).toBe("generique");
      expect(parSlug.get("transverse")!.retenu).toBe(true);
    });

    it("dit pourquoi un projet non classifié ne voit rien, au lieu d'une liste vide muette", async () => {
      const projetId = await creerProjet(null);

      const { body } = await appeler<{ projet: { avertissement: string | null } }>("POST", "/admin/simuler", {
        projetId,
      });

      expect(body.projet.avertissement).toContain("non classifié");
    });

    it("404 sur un projet inconnu", async () => {
      const { status } = await appeler("POST", "/admin/simuler", {
        projetId: "00000000-0000-0000-0000-000000000000",
      });

      expect(status).toBe(404);
    });
  });
});
