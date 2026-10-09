import { TestingModule } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";

const SOURCE = "00000000-0000-7000-8000-000000000001";
const DOUBLON = "00000000-0000-7000-8000-000000000002";

// code → (famille, label) for the test method
const REFERENTIEL: [number, string, string][] = [
  [1, "thematiques", "Gestion des déchets"],
  [2, "thematiques", "Risques technologiques"],
  [3, "thematiques", "Cours d'eau"],
  [10, "sites", "Installation de stockage de déchets"],
  [11, "sites", "Site industriel"],
  [20, "interventions", "Etude/Diagnostic"],
  [30, "nature", "Projet opérationnel"],
  [31, "nature", "Diagnostic"],
  [40, "leviers", "Prévention des déchets"],
  [50, "competences", "90-721"],
  [51, "competences", "90-70"],
  [60, "te", "global"],
  [61, "te", "attenuation"],
  [70, "bv_attenuation", "favorable"],
  [71, "bv_eau", "non coté"],
];

// scores in hundredths, aligned with CODES
const CODES = [1, 2, 3, 10, 11, 20, 30, 31, 40, 50, 51, 60, 61, 70, 71];
const SCORES = [93, 47, 50, 80, 20, 40, 70, 30, 62, 81, 41, 90, 60, 93, 76];

describe("data_projets_consolides labels scores - Integration Tests", () => {
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
  });

  beforeEach(async () => {
    const db = testDbService.database;
    // cascades to referentiel, scores and rattachements
    await db.execute(sql`DELETE FROM data_projets_consolides.labels_methodes`);
    await db.execute(
      sql`INSERT INTO data_projets_consolides.labels_methodes (id, methode) VALUES (1, 'methode-test'), (2, 'autre-methode')`,
    );
    for (const [code, famille, label] of REFERENTIEL) {
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_referentiel (methode_id, code, famille, label)
            VALUES (1, ${code}, ${famille}, ${label})`,
      );
    }
    await db.execute(
      sql`INSERT INTO data_projets_consolides.labels_scores (source_projet_id, methode_id, codes, scores)
          VALUES (${SOURCE}, 1, ${`{${CODES.join(",")}}`}::smallint[], ${`{${SCORES.join(",")}}`}::smallint[])`,
    );
    await db.execute(
      sql`INSERT INTO data_projets_consolides.labels_rattachements (projet_id, methode_id, source_projet_id)
          VALUES (${SOURCE}, 1, ${SOURCE}), (${DOUBLON}, 1, ${SOURCE})`,
    );
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  }, 30000);

  describe("labels_au_seuil", () => {
    const thematiques = JSON.stringify({
      "Gestion des déchets": 0.93,
      "Risques technologiques": 0.47,
      "Cours d'eau": 0.5,
    });

    it("keeps labels at or above the threshold, strongest first", async () => {
      const { rows } = await testDbService.database.execute(
        sql`SELECT data_projets_consolides.labels_au_seuil(${thematiques}::jsonb, 0.5) AS labels`,
      );
      expect(rows[0].labels).toEqual(["Gestion des déchets", "Cours d'eau"]);
    });

    it("lets the caller move the threshold without reloading anything", async () => {
      const { rows } = await testDbService.database.execute(
        sql`SELECT data_projets_consolides.labels_au_seuil(${thematiques}::jsonb, 0.4) AS labels`,
      );
      expect(rows[0].labels).toEqual(["Gestion des déchets", "Cours d'eau", "Risques technologiques"]);
    });

    it("returns an empty array for missing scores", async () => {
      const { rows } = await testDbService.database.execute(
        sql`SELECT data_projets_consolides.labels_au_seuil(NULL::jsonb, 0.5) AS labels`,
      );
      expect(rows[0].labels).toEqual([]);
    });
  });

  describe("label_dominant", () => {
    it("returns the highest scored label, null when there is none", async () => {
      const { rows } = await testDbService.database.execute(
        sql`SELECT data_projets_consolides.label_dominant('{"Projet opérationnel": 0.7, "Diagnostic": 0.3}'::jsonb) AS dominant,
                   data_projets_consolides.label_dominant('{}'::jsonb) AS vide`,
      );
      expect(rows[0].dominant).toBe("Projet opérationnel");
      expect(rows[0].vide).toBeNull();
    });
  });

  describe("labels_scores_lisibles", () => {
    it("decodes coded scores into readable labels grouped by family", async () => {
      const { rows } = await testDbService.database.execute(
        sql`SELECT data_projets_consolides.labels_scores_lisibles(1::smallint, '{1,30,99}'::smallint[], '{93,70,55}'::smallint[]) AS scores`,
      );
      // code 99 is not in the referentiel: ignored rather than surfaced as a nameless label
      expect(rows[0].scores).toEqual({
        thematiques: { "Gestion des déchets": 0.93 },
        nature: { "Projet opérationnel": 0.7 },
      });
    });
  });

  describe("labels_seuil_provisoire view", () => {
    it("serves a duplicate row with the labels of the row that was actually classified", async () => {
      const { rows } = await testDbService.database.execute(
        sql`SELECT * FROM data_projets_consolides.labels_seuil_provisoire WHERE projet_id = ${DOUBLON}`,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        methode: "methode-test",
        source_projet_id: SOURCE,
        classification_thematiques: ["Gestion des déchets", "Cours d'eau"],
        classification_sites: ["Installation de stockage de déchets"],
        classification_interventions: [],
        leviers: ["Prévention des déchets"],
        competences_m57: ["90-721"],
        nature: "Projet opérationnel",
        nature_confiance: 0.7,
        te_global: 0.9,
        te_attenuation: 0.6,
        te_adaptation: null,
        bv_attenuation_cotation: "favorable",
        bv_eau_cotation: "non coté",
        bv_adaptation_cotation: null,
      });
      expect((rows[0].scores as Record<string, unknown>).thematiques).toEqual({
        "Gestion des déchets": 0.93,
        "Risques technologiques": 0.47,
        "Cours d'eau": 0.5,
      });
    });

    it("is mirrored column for column by the materialized view once refreshed", async () => {
      const db = testDbService.database;
      // a classified text without any score kept must still come out, with empty labels
      const VIDE = "00000000-0000-7000-8000-000000000003";
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_scores (source_projet_id, methode_id, codes, scores)
            VALUES (${VIDE}, 1, '{}'::smallint[], '{}'::smallint[])`,
      );
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_rattachements (projet_id, methode_id, source_projet_id)
            VALUES (${VIDE}, 1, ${VIDE})`,
      );
      await db.execute(sql`REFRESH MATERIALIZED VIEW data_projets_consolides.labels_seuil_provisoire_materialise`);

      const vue = await db.execute(
        sql`SELECT * FROM data_projets_consolides.labels_seuil_provisoire ORDER BY projet_id`,
      );
      const materialisee = await db.execute(
        sql`SELECT * FROM data_projets_consolides.labels_seuil_provisoire_materialise ORDER BY projet_id`,
      );

      expect(materialisee.rows).toHaveLength(3);
      const sansScores = vue.rows.map((ligne) =>
        Object.fromEntries(Object.entries(ligne).filter(([k]) => k !== "scores")),
      );
      expect(materialisee.rows).toEqual(sansScores);
      expect(materialisee.rows[2]).toMatchObject({ projet_id: VIDE, classification_thematiques: [], nature: null });
    });

    it("keeps methods side by side so a load can be rolled back by method", async () => {
      const db = testDbService.database;
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_referentiel (methode_id, code, famille, label)
            VALUES (2, 1, 'thematiques', 'Tourisme')`,
      );
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_scores (source_projet_id, methode_id, codes, scores)
            VALUES (${SOURCE}, 2, '{1}'::smallint[], '{90}'::smallint[])`,
      );
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_rattachements (projet_id, methode_id, source_projet_id)
            VALUES (${SOURCE}, 2, ${SOURCE})`,
      );

      const both = await db.execute(
        sql`SELECT methode, classification_thematiques FROM data_projets_consolides.labels_seuil_provisoire
            WHERE projet_id = ${SOURCE} ORDER BY methode`,
      );
      expect(both.rows.map((r) => r.methode)).toEqual(["autre-methode", "methode-test"]);
      expect(both.rows[0].classification_thematiques).toEqual(["Tourisme"]);

      await db.execute(sql`DELETE FROM data_projets_consolides.labels_methodes WHERE id = 2`);
      const remaining = await db.execute(
        sql`SELECT methode FROM data_projets_consolides.labels_seuil_provisoire WHERE projet_id = ${SOURCE}`,
      );
      expect(remaining.rows.map((r) => r.methode)).toEqual(["methode-test"]);
    });
  });
});
