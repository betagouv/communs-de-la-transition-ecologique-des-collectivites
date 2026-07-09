import { Queue } from "bullmq";
import { MecService } from "./mec.service";
import { DatabaseService } from "@database/database.service";
import { CreateMecProjetRequest, UpdateMecProjetRequest } from "./dto/create-mec-projet.dto";
import {
  PROJECT_QUALIFICATION_CLASSIFICATION_JOB,
  PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB,
} from "@/projet-qualification/const";

// Test unitaire pur (DB + queue mockées) de l'enqueue de la prédiction leviers sur /mec/v1.
// Le worker lui-même est testé séparément (projet-qualification.leviers-mec.spec.ts).
describe("MecService — enqueue prédiction leviers (/mec/v1)", () => {
  let selectLimit: jest.Mock;
  let insertValues: jest.Mock;
  let updateWhere: jest.Mock;
  let add: jest.Mock;
  let service: MecService;

  const makeDb = () => {
    selectLimit = jest.fn();
    insertValues = jest.fn().mockResolvedValue(undefined);
    updateWhere = jest.fn().mockResolvedValue(undefined);
    const database = {
      select: jest.fn().mockReturnValue({ from: () => ({ where: () => ({ limit: selectLimit }) }) }),
      insert: jest.fn().mockReturnValue({ values: insertValues }),
      update: jest.fn().mockReturnValue({ set: () => ({ where: updateWhere }) }),
    } as unknown as DatabaseService["database"];
    return database;
  };

  const baseDto = (overrides: Partial<CreateMecProjetRequest> = {}): CreateMecProjetRequest =>
    ({
      nom: "Rénovation de l'école",
      externalId: "mec-42",
      description: "Isolation thermique et panneaux solaires",
      collectivites: [{ type: "Commune", code: "80021" }],
      ...overrides,
    }) as CreateMecProjetRequest;

  beforeEach(() => {
    const dbService = { database: makeDb() } as unknown as DatabaseService;
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as never;
    add = jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue;
    service = new MecService(dbService, logger, queue);
  });

  const jobNames = (): string[] => (add.mock.calls as [string, unknown][]).map((c) => c[0]);

  it("enqueue la prédiction leviers (data_mec) à la création, avec retry", async () => {
    selectLimit
      .mockResolvedValueOnce([{ siren: "218000217" }]) // resolveCollectivite (Commune)
      .mockResolvedValueOnce([]); // existingExternal → aucun (nouveau projet)

    await service.createOrUpdate(baseDto());

    expect(jobNames()).toContain(PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB);
    // Nom de job DISTINCT (robuste au rolling deploy) + options de retry alignées sur les
    // autres producteurs (un échec LLM transitoire ne laisse pas llm_leviers NULL à vie).
    expect(add).toHaveBeenCalledWith(
      PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB,
      expect.objectContaining({ schema: "data_mec" }),
      expect.objectContaining({ attempts: 3, backoff: { type: "exponential", delay: 5000 } }),
    );
  });

  it("prédit les leviers même quand leviers_sgpe est fourni (provenances distinctes)", async () => {
    selectLimit.mockResolvedValueOnce([{ siren: "218000217" }]).mockResolvedValueOnce([]);

    await service.createOrUpdate(baseDto({ leviers: ["Vélo"] }));

    expect(jobNames()).toContain(PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB);
  });

  it("enqueue classification + leviers quand le contenu d'un projet existant change", async () => {
    selectLimit
      .mockResolvedValueOnce([{ siren: "218000217" }]) // resolveCollectivite
      .mockResolvedValueOnce([{ objetId: "existing-uuid" }]) // existingExternal → trouvé
      .mockResolvedValueOnce([{ contentHash: "ancien-hash-different" }]); // contenu précédent

    await service.createOrUpdate(baseDto());

    expect(jobNames()).toEqual(
      expect.arrayContaining([PROJECT_QUALIFICATION_CLASSIFICATION_JOB, PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB]),
    );
  });

  describe("update (PATCH /mec/v1/projets/:id)", () => {
    const patch = (dto: UpdateMecProjetRequest) => service.update("p1", dto);

    it("recalcule le hash et ré-enqueue classification + leviers quand le texte change", async () => {
      selectLimit.mockResolvedValueOnce([
        { id: "p1", nom: "Ancien nom", description: "ancienne desc", contentHash: "ancien-hash" },
      ]);

      await patch({ nom: "Nouveau nom de projet" });

      expect(jobNames()).toEqual(
        expect.arrayContaining([PROJECT_QUALIFICATION_CLASSIFICATION_JOB, PROJECT_QUALIFICATION_LEVIERS_DATA_MEC_JOB]),
      );
    });

    it("ne ré-enqueue rien quand le PATCH ne touche pas nom/description", async () => {
      selectLimit.mockResolvedValueOnce([{ id: "p1", nom: "Nom", description: "desc", contentHash: "hash" }]);

      await patch({ budgetPrevisionnel: 1000 });

      expect(add).not.toHaveBeenCalled();
    });

    it("ne ré-enqueue rien quand le texte fourni est identique (hash inchangé)", async () => {
      // Le hash existant correspond au (nom, description) qui seront réappliqués.
      const nom = "Nom identique";
      const description = "desc identique";
      const computeHash = (
        service as unknown as { computeContentHash(n: string, d: string | null): string }
      ).computeContentHash.bind(service);
      selectLimit.mockResolvedValueOnce([{ id: "p1", nom, description, contentHash: computeHash(nom, description) }]);

      await patch({ nom, description });

      expect(add).not.toHaveBeenCalled();
    });
  });
});
