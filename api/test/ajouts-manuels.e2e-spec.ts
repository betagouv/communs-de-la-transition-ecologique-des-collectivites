import { eq } from "drizzle-orm";
import { AideClassification } from "@/aides/dto/aides.dto";
import { collectivites, projets, servicesNumeriques } from "@database/schema";
import { mockedDefaultCollectivite, mockProjetPayload } from "@test/mocks/mockProjetPayload";
import { createApiClient } from "@test/helpers/api-client";
import { E2E_BASE_URL } from "@test/helpers/e2e-port";

interface AjoutManuel {
  decisionId: string;
  message?: string;
  plateforme: string;
  date: string;
}
interface Service {
  id: string;
  nom: string;
  ajoutManuel?: AjoutManuel;
}

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

const service = (over: { slug: string; nom: string; classification?: AideClassification }) => ({
  description: `Description de ${over.nom}`,
  categories: [],
  presentationGenerique: "non",
  classification: over.classification ?? ({ thematiques: [], sites: [], interventions: [] } as AideClassification),
  phases: {},
  ...over,
});

const appeler = async <T>(
  methode: "GET" | "POST" | "DELETE",
  chemin: string,
  body?: unknown,
  cle = process.env.MEC_API_KEY,
): Promise<{ status: number; body: T }> => {
  const r = await fetch(`${E2E_BASE_URL}${chemin}`, {
    method: methode,
    headers: { ...(cle ? { Authorization: `Bearer ${cle}` } : {}), "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as T };
};

const getServices = async (projetId: string, cle = process.env.MEC_API_KEY): Promise<Service[]> =>
  (await appeler<{ services: Service[] }>("GET", `/projets/${projetId}/services`, undefined, cle)).body.services;

/**
 * Ajouts manuels d'aides et de services numériques.
 *
 * Les cas « aide » ne sont pas testés ici : la garde du périmètre appelle Aides-territoires, qu'on
 * ne veut pas joindre en e2e. Elle est couverte en unitaire (ajouts-manuels.service.spec.ts), avec
 * le périmètre mocké.
 */
describe("Ajouts manuels (e2e)", () => {
  const api = createApiClient(process.env.MEC_API_KEY);

  const creerProjet = async (classification: AideClassification | null) => {
    const { data } = await api.projets.create(mockProjetPayload());
    const projetId = (data as { id: string }).id;
    await global.testDbService.database
      .update(projets)
      .set({ classificationScores: classification })
      .where(eq(projets.id, projetId));
    return projetId;
  };

  const ajouterService = (projetId: string, slug: string, message?: string, cle = process.env.MEC_API_KEY) =>
    appeler<{ decisionId: string }>("POST", `/projets/${projetId}/services/ajouts`, { slug, message }, cle);

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

  describe("Ajouter un service numérique", () => {
    it("le fait remonter sur le projet, avec son message, alors que le score ne l'aurait jamais retenu", async () => {
      // Le service parle de vélo, le projet d'eaux pluviales : aucun recouvrement, score nul.
      // C'est exactement le cas d'usage — un humain sait quelque chose que le moteur ignore.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "hors-sujet", nom: "Hors sujet", classification: VELO })]);
      const projetId = await creerProjet(EAU);

      expect(await getServices(projetId)).toEqual([]);

      const { status } = await ajouterService(projetId, "hors-sujet", "Recommandé par la DDT lors du COPIL du 12/03");
      expect(status).toBe(201);

      const [affiche] = await getServices(projetId);
      expect(affiche.id).toBe("hors-sujet");
      expect(affiche.ajoutManuel?.message).toBe("Recommandé par la DDT lors du COPIL du 12/03");
      expect(affiche.ajoutManuel?.plateforme).toBeTruthy();
    });

    it("place les ajouts manuels EN TÊTE, devant les services retenus par le score", async () => {
      // Quelqu'un les a délibérément mis là. Les noyer dans le tri par score les rendrait
      // indiscernables du résultat du moteur — or c'est la distinction qu'on veut rendre visible.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([
          service({ slug: "pertinent", nom: "Pertinent", classification: EAU }),
          service({ slug: "ajoute", nom: "Ajouté", classification: VELO }),
        ]);
      const projetId = await creerProjet(EAU);

      await ajouterService(projetId, "ajoute");

      expect((await getServices(projetId)).map((s) => s.id)).toEqual(["ajoute", "pertinent"]);
    });

    it("n'affiche QU'UNE fois un service à la fois pertinent et ajouté à la main", async () => {
      // Le dédoublonnage se fait ici, pas dans le client : chaque consommateur devrait sinon le
      // refaire, et finirait par l'oublier. La marque d'ajout l'emporte.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "double", nom: "Double", classification: EAU })]);
      const projetId = await creerProjet(EAU);

      await ajouterService(projetId, "double", "Confirmé en réunion");

      const services = await getServices(projetId);
      expect(services).toHaveLength(1);
      expect(services[0].ajoutManuel?.message).toBe("Confirmé en réunion");
    });

    it("refuse un slug inconnu du catalogue", async () => {
      // Un slug inconnu produirait un ajout qu'aucune lecture ne saurait résoudre : invisible,
      // donc un bug silencieux. On refuse là où on peut encore l'expliquer.
      const projetId = await creerProjet(EAU);

      expect((await ajouterService(projetId, "service-qui-nexiste-pas")).status).toBe(404);
    });

    it("refuse un projet inconnu", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "un-service", nom: "Un service" })]);

      const { status } = await ajouterService("00000000-0000-0000-0000-000000000000", "un-service");
      expect(status).toBe(404);
    });
  });

  describe("Retirer un ajout", () => {
    it("le fait disparaître, sans rien effacer du journal", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "ajoute", nom: "Ajouté", classification: VELO })]);
      const projetId = await creerProjet(EAU);

      const { body } = await ajouterService(projetId, "ajoute");
      expect(await getServices(projetId)).toHaveLength(1);

      const retrait = await appeler("DELETE", `/projets/${projetId}/ajouts/${body.decisionId}`);
      expect(retrait.status).toBe(200);

      expect(await getServices(projetId)).toEqual([]);
    });

    it("peut être ré-ajouté après retrait", async () => {
      // La pierre tombale ne doit pas verrouiller l'objet : c'est un retrait, pas une interdiction.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "ajoute", nom: "Ajouté", classification: VELO })]);
      const projetId = await creerProjet(EAU);

      const { body } = await ajouterService(projetId, "ajoute");
      await appeler("DELETE", `/projets/${projetId}/ajouts/${body.decisionId}`);

      await ajouterService(projetId, "ajoute", "Finalement si");

      const services = await getServices(projetId);
      expect(services).toHaveLength(1);
      expect(services[0].ajoutManuel?.message).toBe("Finalement si");
    });

    it("404 sur un ajout inconnu", async () => {
      const projetId = await creerProjet(EAU);

      const { status } = await appeler("DELETE", `/projets/${projetId}/ajouts/00000000-0000-0000-0000-000000000000`);
      expect(status).toBe(404);
    });
  });

  describe("Cloisonnement par plateforme", () => {
    it("une plateforme ne voit pas les ajouts d'une autre", async () => {
      // Même règle que pour toute décision : la plateforme est dérivée de la clé d'API. TeT ne doit
      // pas hériter des ajouts que MEC a faits pour ses propres agents.
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "ajoute", nom: "Ajouté", classification: VELO })]);
      const projetId = await creerProjet(EAU);

      await ajouterService(projetId, "ajoute", "Ajout de MEC");

      expect(await getServices(projetId, process.env.MEC_API_KEY)).toHaveLength(1);
      expect(await getServices(projetId, process.env.TET_API_KEY)).toHaveLength(0);
    });

    it("une plateforme ne peut pas retirer l'ajout d'une autre", async () => {
      await global.testDbService.database
        .insert(servicesNumeriques)
        .values([service({ slug: "ajoute", nom: "Ajouté", classification: VELO })]);
      const projetId = await creerProjet(EAU);

      const { body } = await ajouterService(projetId, "ajoute");

      const retrait = await appeler(
        "DELETE",
        `/projets/${projetId}/ajouts/${body.decisionId}`,
        undefined,
        process.env.TET_API_KEY,
      );
      expect(retrait.status).toBe(404);

      // L'ajout de MEC est intact.
      expect(await getServices(projetId, process.env.MEC_API_KEY)).toHaveLength(1);
    });
  });
});
