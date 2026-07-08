import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PgDialect } from "drizzle-orm/pg-core";
import { TerritoiresService } from "./territoires.service";
import { DatabaseService } from "@database/database.service";

describe("TerritoiresService", () => {
  let execute: jest.Mock;
  let selectLimit: jest.Mock;
  let service: TerritoiresService;

  // Rend le SQL généré en texte : permet d'asserter la présence/absence de clauses
  // conditionnelles (filtre obsolètes) sans base de données.
  const renderSql = (q: unknown) => new PgDialect().sqlToQuery(q as never).sql;

  // execute() sert les requêtes SQL brutes ; select().from().where().limit() la résolution external_id.
  const makeDb = () => {
    execute = jest.fn();
    selectLimit = jest.fn();
    const where = jest.fn().mockReturnValue({ limit: selectLimit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    return { execute, select } as unknown as DatabaseService["database"];
  };

  beforeEach(() => {
    const dbService = { database: makeDb() } as unknown as DatabaseService;
    service = new TerritoiresService(dbService);
  });

  describe("territoireProjets", () => {
    const params = { limit: 50, offset: 0, inclureFinancementsSeuls: false, masquerObsoletes: false };

    it("renvoie la forme { total, limit, offset, groupes } (chaque groupe a decisions[])", async () => {
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence de la commune au référentiel
        .mockResolvedValueOnce({
          rows: [
            {
              confiance: "CERTAIN",
              traces: [{ role: "projet", source: "MEC", id: "p1" }],
              total: "1",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // décisions actives de la page (aucune)

      const result = await service.territoireProjets("01001", params);

      expect(result).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
        groupes: [{ confiance: "CERTAIN", traces: [{ role: "projet", source: "MEC", id: "p1" }], decisions: [] }],
      });
      // existence commune + groupes + décisions de la page.
      expect(execute).toHaveBeenCalledTimes(3);
    });

    it("attache les décisions actives au groupe, sans l'auteur, en une seule requête", async () => {
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence commune
        .mockResolvedValueOnce({
          rows: [
            {
              confiance: "PROBABLE",
              traces: [
                { role: "projet", source: "MEC", id: "p1" },
                { role: "projet", source: "Vivier COP", id: "cop_2" },
              ],
              total: "1",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              type: "doublon_confirme",
              verdict: null,
              plateforme: "MEC",
              createdAt: new Date("2026-07-01T08:00:00.000Z"),
              objetAId: "p1",
              objetBId: "cop_2",
              commentaire: "même projet",
            },
          ],
        });

      const result = await service.territoireProjets("01001", params);

      // Une seule requête de décisions pour toute la page.
      expect(execute).toHaveBeenCalledTimes(3);
      // La décision touche p1 (A) ET cop_2 (B), tous deux dans le groupe → attachée UNE fois.
      expect(result.groupes[0].decisions).toEqual([
        {
          type: "doublon_confirme",
          verdict: null,
          plateforme: "MEC",
          createdAt: "2026-07-01T08:00:00.000Z",
          objetAId: "p1",
          objetBId: "cop_2",
          commentaire: "même projet",
        },
      ]);
      // Aucun champ auteur exposé.
      expect(result.groupes[0].decisions[0]).not.toHaveProperty("auteur");

      // La requête d'enrichissement filtre le vocabulaire fermé, borne le résultat
      // et départage les created_at égaux (id DESC).
      const decisionsSql = renderSql((execute.mock.calls[2] as unknown[])[0]);
      expect(decisionsSql).toContain("type_decision = ANY");
      expect(decisionsSql).toContain("d.id DESC");
      expect(decisionsSql).toContain("LIMIT");
    });

    it("ne lance pas de requête de décisions quand la page est vide", async () => {
      execute.mockResolvedValueOnce({ rows: [{ ok: 1 }] }).mockResolvedValueOnce({ rows: [] });
      const result = await service.territoireProjets("01001", params);
      expect(result).toEqual({ total: 0, limit: 50, offset: 0, groupes: [] });
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it("masquerObsoletes=true ajoute le filtre has_obsolete à la requête de page", async () => {
      execute.mockResolvedValueOnce({ rows: [{ ok: 1 }] }).mockResolvedValueOnce({ rows: [] });
      await service.territoireProjets("01001", { ...params, masquerObsoletes: true });
      const pageSql = renderSql((execute.mock.calls[1] as unknown[])[0]);
      expect(pageSql).toContain("obsolete_pids");
      expect(pageSql).toContain("has_obsolete = FALSE");
      // Départage déterministe des created_at égaux dans obsolete_pids.
      expect(pageSql).toContain("d.id DESC");
    });

    it("masquerObsoletes=false (défaut) n'ajoute pas le filtre has_obsolete", async () => {
      execute.mockResolvedValueOnce({ rows: [{ ok: 1 }] }).mockResolvedValueOnce({ rows: [] });
      await service.territoireProjets("01001", params);
      const pageSql = renderSql((execute.mock.calls[1] as unknown[])[0]);
      // obsolete_pids reste calculé, mais le filtre n'est pas appliqué.
      expect(pageSql).toContain("obsolete_pids");
      expect(pageSql).not.toContain("has_obsolete = FALSE");
    });

    it("accepte un code commune corse (2A/2B + 3)", async () => {
      execute.mockResolvedValueOnce({ rows: [{ ok: 1 }] }).mockResolvedValueOnce({ rows: [] });
      const result = await service.territoireProjets("2a004", params);
      expect(result.total).toBe(0);
    });

    it("404 pour une commune de format valide mais inconnue du référentiel", async () => {
      execute.mockResolvedValueOnce({ rows: [] });
      await expect(service.territoireProjets("99999", params)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("récupère le vrai total via un COUNT quand la page est vide au-delà de l'offset", async () => {
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence commune
        .mockResolvedValueOnce({ rows: [] }) // page vide
        .mockResolvedValueOnce({ rows: [{ total: "12" }] }); // COUNT de repli
      const result = await service.territoireProjets("01001", { ...params, offset: 100 });
      expect(result.total).toBe(12);
      // Page vide → pas de requête de décisions.
      expect(execute).toHaveBeenCalledTimes(3);
    });

    it("résout un EPCI (SIREN 9 chiffres) en ses communes, 404 si aucune", async () => {
      execute.mockResolvedValueOnce({ rows: [] }); // périmètre vide
      await expect(service.territoireProjets("200000172", params)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404 pour un code de format invalide (aucune requête)", async () => {
      await expect(service.territoireProjets("abc", params)).rejects.toBeInstanceOf(NotFoundException);
      expect(execute).not.toHaveBeenCalled();
    });

    it("400 si copMillesime invalide", async () => {
      await expect(service.territoireProjets("01001", { ...params, copMillesime: "2099" })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(execute).not.toHaveBeenCalled();
    });

    it("400 si copStatutVivier invalide", async () => {
      await expect(
        service.territoireProjets("01001", { ...params, copStatutVivier: "peut_etre" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe("qualification", () => {
    it("404 quand l'external_id est inconnu", async () => {
      selectLimit.mockResolvedValueOnce([]);
      await expect(service.qualification("mec-unknown")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404 quand l'external_id résout vers un projet orphelin (hors schéma commun)", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute.mockResolvedValueOnce({ rows: [] }); // projet absent de projets_operationnels
      await expect(service.qualification("mec-orphan")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("découpe les leviers, normalise proba et date pour un external_id connu", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute.mockResolvedValueOnce({
        rows: [
          {
            leviersSgpe: "Vélo,Covoiturage",
            llmThematiques: [{ label: "Mobilité", score: 0.9 }],
            llmProbabiliteTe: 0.87,
            llmClassifiedAt: new Date("2026-07-01T08:00:00.000Z"),
          },
        ],
      });

      const result = await service.qualification("mec-123");

      expect(result).toEqual({
        externalId: "mec-123",
        projetId: "proj-uuid",
        leviersSgpe: ["Vélo", "Covoiturage"],
        llmThematiques: [{ label: "Mobilité", score: 0.9 }],
        llmProbabiliteTe: 0.87,
        llmClassifiedAt: "2026-07-01T08:00:00.000Z",
      });
    });
  });

  describe("planFichesTerritoire", () => {
    it("404 quand l'external_id est inconnu", async () => {
      selectLimit.mockResolvedValueOnce([]);
      await expect(service.planFichesTerritoire("mec-unknown")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404 quand le projet est orphelin (hors schéma commun)", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute.mockResolvedValueOnce({ rows: [] }); // existence projet → absent
      await expect(service.planFichesTerritoire("mec-orphan")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("renvoie pcaet vide sans communes rattachées", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence projet
        .mockResolvedValueOnce({ rows: [] }); // communes du projet
      const result = await service.planFichesTerritoire("mec-123");
      expect(result).toEqual({ pcaet: [], fichesActionSuggerees: [] });
    });

    it("renvoie pcaet vide quand la table de référence n'existe pas encore (chantier T4)", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence projet
        .mockResolvedValueOnce({ rows: [{ insee: "01001" }] }) // communes du projet
        .mockResolvedValueOnce({ rows: [{ present: false }] }); // pcaet_reference absente en prod
      const result = await service.planFichesTerritoire("mec-123");
      expect(result).toEqual({ pcaet: [], fichesActionSuggerees: [] });
    });

    it("mappe les PCAET et leur rattachement (décision active la plus récente)", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence projet
        .mockResolvedValueOnce({ rows: [{ insee: "01001" }] }) // communes du projet
        .mockResolvedValueOnce({ rows: [{ present: true }] }) // pcaet_reference présente
        .mockResolvedValueOnce({
          rows: [
            {
              nom: "PCAET Test",
              sirenPorteur: "200000172",
              presentDansTet: true,
              tetExternalId: "tet-9",
              source: "snapshot",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ siren: "200000172", verdict: "confirme" }] }); // rattachement

      const result = await service.planFichesTerritoire("mec-123");

      expect(result).toEqual({
        pcaet: [
          {
            nom: "PCAET Test",
            sirenPorteur: "200000172",
            presentDansTet: true,
            tetExternalId: "tet-9",
            source: "snapshot",
            rattachement: "confirme",
          },
        ],
        fichesActionSuggerees: [],
      });
      // La requête de rattachement départage les created_at égaux (id DESC).
      const rattachementSql = renderSql((execute.mock.calls[4] as unknown[])[0]);
      expect(rattachementSql).toContain("d.id DESC");
    });

    it("rattachement='aucun' quand aucune décision active", async () => {
      selectLimit.mockResolvedValueOnce([{ objetId: "proj-uuid" }]);
      execute
        .mockResolvedValueOnce({ rows: [{ ok: 1 }] }) // existence projet
        .mockResolvedValueOnce({ rows: [{ insee: "01001" }] }) // communes
        .mockResolvedValueOnce({ rows: [{ present: true }] }) // pcaet_reference présente
        .mockResolvedValueOnce({
          rows: [
            {
              nom: "PCAET Sans Décision",
              sirenPorteur: "244400404",
              presentDansTet: false,
              tetExternalId: null,
              source: "opendata",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // aucune décision de rattachement

      const result = await service.planFichesTerritoire("mec-123");

      expect(result.pcaet[0].rattachement).toBe("aucun");
    });
  });
});
