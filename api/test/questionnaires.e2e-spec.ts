import { eq } from "drizzle-orm";
import { collectivites, projets } from "@database/schema";
import { AideClassification } from "@/aides/dto/aides.dto";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { createApiClient } from "@test/helpers/api-client";
import { E2E_BASE_URL } from "@test/helpers/e2e-port";

// Les endpoints questionnaires/recommandations sont trop récents pour figurer dans
// test/generated-types.ts (regénéré par `pnpm generate-types`). On tape donc l'API en fetch
// brut : c'est du e2e réel — app Nest bootée, Postgres réel, migrations appliquées.
const BASE_URL = E2E_BASE_URL;

const SLUG = "atoutbiodiv-salle";

// Classification d'un projet de salle des fêtes : c'est elle qui rend AtoutBiodiv éligible,
// via le score de matching (cf. src/questionnaires/eligibilite.spec.ts).
const PROJET_SALLE: AideClassification = {
  thematiques: [],
  sites: [{ label: "Salle des fêtes, salle associative, pôle musical", score: 0.95 }],
  interventions: [{ label: "Construction bâtiment", score: 0.9 }],
};

// Partage une intervention avec AtoutBiodiv, mais reste sous le seuil d'éligibilité.
const PROJET_PISCINE: AideClassification = {
  thematiques: [],
  sites: [{ label: "Piscine", score: 0.95 }],
  interventions: [{ label: "Rénovation bâtiment", score: 0.9 }],
};

// Questions et options du contenu partenaire (content/questionnaires/atoutbiodiv-salle.json).
const Q_ESPACES = "part-estimee-des-espaces-exterieurs";
const Q_TERRAIN = "quelle-est-la-nature-actuelle";
const Q_PROXIMITE = "le-terrain-est-il-situe";
const Q_ECLAIRAGE = "eclairage-exterieur-prevu-parking-cheminements";

// Recommandations conditionnelles / inconditionnelles du même fichier.
const RECO_HAIES = "questionnaire:atoutbiodiv-salle:haies";
const RECO_MARE = "questionnaire:atoutbiodiv-salle:mare";
const RECO_ECLAIRAGE = "questionnaire:atoutbiodiv-salle:eclairage";
const RECO_NICHOIRS = "questionnaire:atoutbiodiv-salle:nichoirs";

interface Questionnaire {
  slug: string;
  version: number;
  statut: "non_commence" | "en_cours" | "complet";
  banniere: { titre: string; sousTitre: string; icone?: string };
  questions: { id: string; type: string; intitule: string; options: { id: string; signal: string }[] }[];
  reponses: Record<string, string>;
}

interface Recommandation {
  id: string;
  source: { type: string; ref?: string; libelle?: string };
  titre: string;
  engagement: string;
  decision: "a_etudier" | "integree" | "ignoree" | null;
}

interface CorpsErreur {
  message?: string;
}
type CorpsQuestionnaires = { questionnaires: Questionnaire[] } & CorpsErreur;
type CorpsRecommandations = { recommandations: Recommandation[] } & CorpsErreur;

const appeler = async <T>(
  methode: "GET" | "PUT",
  chemin: string,
  body?: unknown,
  apiKey = process.env.MEC_API_KEY,
): Promise<{ status: number; body: T }> => {
  const reponse = await fetch(`${BASE_URL}${chemin}`, {
    method: methode,
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: reponse.status, body: (await reponse.json().catch(() => null)) as T };
};

const getQuestionnaires = async (projetId: string): Promise<Questionnaire[]> =>
  (await appeler<CorpsQuestionnaires>("GET", `/projets/${projetId}/questionnaires`)).body.questionnaires;

const getRecommandations = async (projetId: string): Promise<Recommandation[]> =>
  (await appeler<CorpsRecommandations>("GET", `/projets/${projetId}/recommandations`)).body.recommandations;

const putReponses = (projetId: string, reponses: Record<string, string>, slug = SLUG) =>
  appeler<CorpsQuestionnaires>("PUT", `/projets/${projetId}/questionnaires/${slug}/reponses`, { reponses });

const putDecision = (projetId: string, recoId: string, decision: string | null) =>
  appeler<CorpsRecommandations>("PUT", `/projets/${projetId}/recommandations/${encodeURIComponent(recoId)}/decision`, {
    decision,
  });

const trouver = (recos: Recommandation[], id: string): Recommandation => {
  const reco = recos.find((r) => r.id === id);
  if (!reco) throw new Error(`Recommandation "${id}" absente de la réponse`);
  return reco;
};

describe("Questionnaires & recommandations (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY);

  /** Crée un projet et force sa classification (normalement écrite par le job LLM). */
  const creerProjet = async (classification: AideClassification): Promise<string> => {
    const { data } = await api.projets.create(mockProjetPayload());
    const projetId = (data as { id: string }).id;

    await global.testDbService.database
      .update(projets)
      .set({ classificationScores: classification })
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

  describe("Éligibilité", () => {
    it("propose AtoutBiodiv à un projet de salle des fêtes, non commencé et sans réponses", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const [questionnaire, ...autres] = await getQuestionnaires(projetId);

      expect(autres).toHaveLength(0);
      expect(questionnaire.slug).toBe(SLUG);
      expect(questionnaire.statut).toBe("non_commence");
      expect(questionnaire.reponses).toEqual({});
      expect(questionnaire.questions).toHaveLength(4);
    });

    it("renvoie une liste vide (200, pas 404) pour un projet sous le seuil d'éligibilité", async () => {
      const projetId = await creerProjet(PROJET_PISCINE);

      const { status, body } = await appeler<CorpsQuestionnaires>("GET", `/projets/${projetId}/questionnaires`);

      expect(status).toBe(200);
      expect(body.questionnaires).toEqual([]);
    });

    it("renvoie une liste vide pour un projet non encore classifié", async () => {
      const { data } = await api.projets.create(mockProjetPayload());
      const projetId = (data as { id: string }).id;

      expect(await getQuestionnaires(projetId)).toEqual([]);
    });

    it("n'expose jamais les conditions ni la classification d'éligibilité", async () => {
      const projetId = await creerProjet(PROJET_SALLE);
      await putReponses(projetId, { [Q_ESPACES]: "importante-plus-de-50" });

      const questionnaires = await appeler<CorpsQuestionnaires>("GET", `/projets/${projetId}/questionnaires`);
      const recommandations = await appeler<CorpsRecommandations>("GET", `/projets/${projetId}/recommandations`);

      const charge = JSON.stringify(questionnaires.body) + JSON.stringify(recommandations.body);
      expect(charge).not.toContain("condition");
      expect(charge).not.toContain("classification");
      expect(charge).not.toContain("eligibilite");
      expect(charge).not.toContain("parmi");
    });

    it("refuse (404) de remplir un questionnaire non proposé au projet", async () => {
      const projetId = await creerProjet(PROJET_PISCINE);

      const { status } = await putReponses(projetId, { [Q_ESPACES]: "importante-plus-de-50" });

      expect(status).toBe(404);
    });

    it("exige une clé d'API valide", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const { status } = await appeler<CorpsErreur>(
        "GET",
        `/projets/${projetId}/questionnaires`,
        undefined,
        "mauvaise-cle",
      );

      expect(status).toBe(401);
    });
  });

  describe("Réponses", () => {
    it("passe en_cours sur réponse partielle, complet quand les 4 questions sont répondues", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const partiel = await putReponses(projetId, { [Q_TERRAIN]: "friche-terrain-nu-ou" });
      expect(partiel.status).toBe(200);
      expect(partiel.body.questionnaires[0].statut).toBe("en_cours");

      const complet = await putReponses(projetId, {
        [Q_TERRAIN]: "friche-terrain-nu-ou",
        [Q_PROXIMITE]: "oui-cours-d-eau",
        [Q_ESPACES]: "importante-plus-de-50",
        [Q_ECLAIRAGE]: "non-ou-eclairage-minimal",
      });
      expect(complet.body.questionnaires[0].statut).toBe("complet");
    });

    it("est idempotent : le corps remplace tout, une réponse retirée est désélectionnée", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      await putReponses(projetId, {
        [Q_TERRAIN]: "friche-terrain-nu-ou",
        [Q_ESPACES]: "importante-plus-de-50",
      });
      const { body } = await putReponses(projetId, { [Q_TERRAIN]: "friche-terrain-nu-ou" });

      expect(body.questionnaires[0].reponses).toEqual({ [Q_TERRAIN]: "friche-terrain-nu-ou" });
      expect(body.questionnaires[0].statut).toBe("en_cours");
    });

    it("rejette (400) une question inconnue", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const { status, body } = await putReponses(projetId, { "question-fantome": "friche-terrain-nu-ou" });

      expect(status).toBe(400);
      expect(body.message).toContain("question-fantome");
    });

    it("rejette (400) une option inconnue pour une question connue", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const { status, body } = await putReponses(projetId, { [Q_TERRAIN]: "option-fantome" });

      expect(status).toBe(400);
      expect(body.message).toContain("option-fantome");
    });

    it("rejette (400) une valeur de réponse non textuelle", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const { status } = await appeler<CorpsErreur>("PUT", `/projets/${projetId}/questionnaires/${SLUG}/reponses`, {
        reponses: { [Q_TERRAIN]: 42 },
      });

      expect(status).toBe(400);
    });

    it("ne renvoie pas de recommandations depuis le PUT des réponses (ressources découplées)", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      const { body } = await putReponses(projetId, { [Q_TERRAIN]: "friche-terrain-nu-ou" });

      expect(body).toHaveProperty("questionnaires");
      expect(body).not.toHaveProperty("recommandations");
    });
  });

  describe("Recommandations", () => {
    it("ne contribue RIEN tant que le questionnaire est non commencé, même les inconditionnelles", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      // AtoutBiodiv-salle porte 3 recommandations `condition: true` (nichoirs, phyto,
      // écologue). Sans la garde « non_commence », elles s'afficheraient avant toute
      // réponse — ce que la spec interdit (§7).
      expect(await getRecommandations(projetId)).toEqual([]);
    });

    it("contribue les inconditionnelles dès la première réponse", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      await putReponses(projetId, { [Q_TERRAIN]: "friche-terrain-nu-ou" });

      const ids = (await getRecommandations(projetId)).map((r) => r.id);
      expect(ids).toContain(RECO_NICHOIRS);
    });

    it("contribue une recommandation conditionnelle quand sa condition est satisfaite", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      // « haies » exige part-espaces ∈ {importante, modérée}. Répondre ailleurs ne suffit pas.
      await putReponses(projetId, { [Q_TERRAIN]: "friche-terrain-nu-ou" });
      expect((await getRecommandations(projetId)).map((r) => r.id)).not.toContain(RECO_HAIES);

      await putReponses(projetId, {
        [Q_TERRAIN]: "friche-terrain-nu-ou",
        [Q_ESPACES]: "importante-plus-de-50",
      });
      const haies = trouver(await getRecommandations(projetId), RECO_HAIES);

      expect(haies.decision).toBeNull();
      expect(haies.source).toEqual({ type: "questionnaire", ref: SLUG, libelle: "AtoutBiodiv" });
      expect(haies.engagement).toBeTruthy();
    });

    it("retire une recommandation dont la condition n'est plus satisfaite", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      await putReponses(projetId, { [Q_PROXIMITE]: "oui-cours-d-eau" });
      expect((await getRecommandations(projetId)).map((r) => r.id)).toContain(RECO_MARE);

      await putReponses(projetId, { [Q_PROXIMITE]: "non-contexte-urbain-ou" });
      expect((await getRecommandations(projetId)).map((r) => r.id)).not.toContain(RECO_MARE);
    });

    it("contribue la recommandation éclairage seulement si un éclairage est prévu", async () => {
      const projetId = await creerProjet(PROJET_SALLE);

      await putReponses(projetId, { [Q_ECLAIRAGE]: "non-ou-eclairage-minimal" });
      expect((await getRecommandations(projetId)).map((r) => r.id)).not.toContain(RECO_ECLAIRAGE);

      await putReponses(projetId, { [Q_ECLAIRAGE]: "oui-eclairage-continu-facades" });
      expect((await getRecommandations(projetId)).map((r) => r.id)).toContain(RECO_ECLAIRAGE);
    });

    it("garantit l'unicité des ids à l'échelle du projet", async () => {
      const projetId = await creerProjet(PROJET_SALLE);
      await putReponses(projetId, {
        [Q_TERRAIN]: "friche-terrain-nu-ou",
        [Q_PROXIMITE]: "oui-cours-d-eau",
        [Q_ESPACES]: "importante-plus-de-50",
        [Q_ECLAIRAGE]: "oui-eclairage-continu-facades",
      });

      const ids = (await getRecommandations(projetId)).map((r) => r.id);

      expect(new Set(ids).size).toBe(ids.length);
      // Toutes les recommandations d'AtoutBiodiv-salle sont contribuées sauf « corridor »,
      // qui exige une haie bocagère adjacente (réponse « oui-boisement-ou-haie »).
      expect(ids).toHaveLength(7);
    });
  });

  describe("Arbitrage", () => {
    const projetAvecHaies = async (): Promise<string> => {
      const projetId = await creerProjet(PROJET_SALLE);
      await putReponses(projetId, { [Q_ESPACES]: "importante-plus-de-50" });
      return projetId;
    };

    it("tranche une recommandation par son seul id et renvoie la liste à jour", async () => {
      const projetId = await projetAvecHaies();

      const { status, body } = await putDecision(projetId, RECO_HAIES, "integree");

      expect(status).toBe(200);
      expect(trouver(body.recommandations, RECO_HAIES).decision).toBe("integree");
    });

    it("n'affecte pas les autres recommandations du projet", async () => {
      const projetId = await projetAvecHaies();

      const { body } = await putDecision(projetId, RECO_HAIES, "integree");

      expect(trouver(body.recommandations, RECO_NICHOIRS).decision).toBeNull();
    });

    it("remplace un arbitrage par un autre", async () => {
      const projetId = await projetAvecHaies();

      await putDecision(projetId, RECO_HAIES, "a_etudier");
      const { body } = await putDecision(projetId, RECO_HAIES, "ignoree");

      expect(trouver(body.recommandations, RECO_HAIES).decision).toBe("ignoree");
    });

    it("efface l'arbitrage avec decision: null (révocation)", async () => {
      const projetId = await projetAvecHaies();

      await putDecision(projetId, RECO_HAIES, "integree");
      const { status, body } = await putDecision(projetId, RECO_HAIES, null);

      expect(status).toBe(200);
      expect(trouver(body.recommandations, RECO_HAIES).decision).toBeNull();
    });

    it("efface un arbitrage inexistant sans erreur (idempotence)", async () => {
      const projetId = await projetAvecHaies();

      const { status } = await putDecision(projetId, RECO_HAIES, null);

      expect(status).toBe(200);
    });

    it("rejette (404) l'arbitrage d'une recommandation non proposée au projet", async () => {
      const projetId = await projetAvecHaies();

      const { status } = await putDecision(projetId, "questionnaire:atoutbiodiv-salle:inexistante", "integree");

      expect(status).toBe(404);
    });

    it("rejette (404) l'arbitrage d'une recommandation dont la condition n'est pas satisfaite", async () => {
      const projetId = await projetAvecHaies();

      // « mare » existe dans le catalogue mais n'est pas contribuée avec ces réponses.
      const { status } = await putDecision(projetId, RECO_MARE, "integree");

      expect(status).toBe(404);
    });

    it("rejette (400) un verdict hors vocabulaire", async () => {
      const projetId = await projetAvecHaies();

      const { status } = await putDecision(projetId, RECO_HAIES, "peut-etre");

      expect(status).toBe(400);
    });

    // Le scénario qui justifie l'id déterministe et le stockage du SEUL arbitrage :
    // la recommandation est recalculée, l'arbitrage lui survit.
    it("conserve l'arbitrage quand la recommandation disparaît puis réapparaît", async () => {
      const projetId = await projetAvecHaies();
      await putDecision(projetId, RECO_HAIES, "integree");

      // La collectivité revient sur sa réponse : « haies » n'est plus contribuée.
      await putReponses(projetId, { [Q_ESPACES]: "reduite-moins-de-30" });
      expect((await getRecommandations(projetId)).map((r) => r.id)).not.toContain(RECO_HAIES);

      // Elle revient à nouveau : la recommandation réapparaît, arbitrée.
      await putReponses(projetId, { [Q_ESPACES]: "importante-plus-de-50" });

      expect(trouver(await getRecommandations(projetId), RECO_HAIES).decision).toBe("integree");
    });

    it("cloisonne les arbitrages par plateforme émettrice", async () => {
      const projetId = await projetAvecHaies();
      await putDecision(projetId, RECO_HAIES, "integree");

      const { body } = await appeler<CorpsRecommandations>(
        "GET",
        `/projets/${projetId}/recommandations`,
        undefined,
        process.env.TET_API_KEY,
      );

      expect(trouver(body.recommandations, RECO_HAIES).decision).toBeNull();
    });
  });
});
