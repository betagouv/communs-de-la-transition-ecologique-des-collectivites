import { TestingModule } from "@nestjs/testing";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { refCommunes, refGroupements, refPerimetres } from "@database/schema";
import { ConsultationService } from "./consultation.service";
import { LABELS_METHODE } from "./consultation-projection";
import { ProjetConsultationDto } from "./dto/projet-consultation.dto";

// The consolidated base is built by the ETL, not by our migrations: the tests create the
// three source tables they read (same columns and types as production).
const DDL = [
  sql`CREATE TABLE data_projets_consolides.projets (
        id uuid PRIMARY KEY,
        nom text NOT NULL,
        description text,
        budget_previsionnel bigint,
        date_debut date,
        date_fin date,
        phase text,
        phase_statut text,
        collectivite_responsable_siren text,
        porteur_operationnel_siret text,
        porteur_nom text,
        territoire_communes text[],
        territoire_departement text,
        localisation_latitude double precision,
        localisation_longitude double precision,
        localisation_adresse text,
        localisation_ban_id text,
        plan_transition_ids uuid[],
        programmes_rattachement text[],
        ouverture text NOT NULL,
        sources text[]
      )`,
  sql`CREATE TABLE data_projets_consolides.financements (
        id uuid PRIMARY KEY,
        projet_id uuid NOT NULL,
        source text NOT NULL,
        reference_externe text,
        date_attribution date,
        montant_demande numeric(14,2),
        montant_attribue numeric(14,2),
        montant_paye numeric(14,2),
        statut text
      )`,
  sql`CREATE TABLE data_projets_consolides.projets_sources (
        projet_id uuid NOT NULL,
        source text NOT NULL,
        id_source uuid NOT NULL,
        role text NOT NULL,
        PRIMARY KEY (source, id_source)
      )`,
];

const PARIS = "217500016";
const EPCI = "200000172";
const COMMUNE_AIN = "210100012";

const uuid = (n: number) => `00000000-0000-5000-8000-${String(n).padStart(12, "0")}`;
const ECOLE = uuid(1); // Paris, dgcl, DETR 2023
const ECOLE_DOUBLON = uuid(2); // Paris, exact duplicate of ECOLE seen by fonds-vert
const STATION = uuid(3); // Paris, agences-eau, 2022
const SANS_LABELS = uuid(4); // Paris, title too short to be classified
const PISTE = uuid(5); // EPCI
const MARE = uuid(6); // commune de l'Ain
const SANS_SIREN = uuid(7);

// code → (famille, label) of the test referential
const REFERENTIEL: [number, string, string][] = [
  [1, "thematiques", "Bâtiments publics"],
  [2, "thematiques", "Assainissement"],
  [3, "thematiques", "Mobilité douce"],
  [10, "nature", "Projet opérationnel"],
  [11, "nature", "Diagnostic"],
  [20, "te", "global"],
  [30, "bv_attenuation", "favorable"],
];

describe("ConsultationService (integration)", () => {
  let service: ConsultationService;
  let module: TestingModule;
  let testDbService: TestDatabaseService;

  const dropTables = async () => {
    const db = testDbService.database;
    await db.execute(sql`DROP TABLE IF EXISTS data_projets_consolides.projets_sources`);
    await db.execute(sql`DROP TABLE IF EXISTS data_projets_consolides.financements`);
    await db.execute(sql`DROP TABLE IF EXISTS data_projets_consolides.projets`);
  };

  const insertProjet = async (
    id: string,
    nom: string,
    siren: string | null,
    source: string,
    extra: { budget?: number; departement?: string } = {},
  ) => {
    const db = testDbService.database;
    await db.execute(sql`
      INSERT INTO data_projets_consolides.projets
        (id, nom, collectivite_responsable_siren, ouverture, sources, budget_previsionnel, territoire_departement, date_debut)
      VALUES (${id}, ${nom}, ${siren}, 'ouvert', ARRAY[${source}], ${extra.budget ?? null},
              ${extra.departement ?? null}, '2023-03-01')`);
    await db.execute(sql`
      INSERT INTO data_projets_consolides.projets_sources (projet_id, source, id_source, role)
      VALUES (${id}, ${source}, ${id}, 'inchange')`);
  };

  let financementSeq = 100;
  const insertFinancement = async (
    projetId: string,
    source: string,
    date: string | null,
    attribue: number | null,
    statut: string | null,
  ) => {
    await testDbService.database.execute(sql`
      INSERT INTO data_projets_consolides.financements (id, projet_id, source, date_attribution, montant_attribue, montant_paye, statut)
      VALUES (${uuid(financementSeq++)}, ${projetId}, ${source}, ${date}, ${attribue}, 999, ${statut})`);
  };

  // One classified text (codes/scores in hundredths), shared by the lines attached to it.
  const insertLabels = async (sourceProjetId: string, scores: Record<number, number>, rattaches: string[]) => {
    const db = testDbService.database;
    const codes = Object.keys(scores).join(",");
    const valeurs = Object.values(scores).join(",");
    await db.execute(sql`
      INSERT INTO data_projets_consolides.labels_scores (source_projet_id, methode_id, codes, scores)
      VALUES (${sourceProjetId}, 1, ${`{${codes}}`}::smallint[], ${`{${valeurs}}`}::smallint[])`);
    for (const projetId of rattaches) {
      await db.execute(sql`
        INSERT INTO data_projets_consolides.labels_rattachements (projet_id, methode_id, source_projet_id)
        VALUES (${projetId}, 1, ${sourceProjetId})`);
    }
  };

  const walk = async (
    fetchPage: (cursor?: string) => Promise<{ data: ProjetConsultationDto[]; nextCursor: string | null }>,
  ): Promise<ProjetConsultationDto[]> => {
    const all: ProjetConsultationDto[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 20; i++) {
      const page = await fetchPage(cursor);
      all.push(...page.data);
      if (!page.nextCursor) return all;
      cursor = page.nextCursor;
    }
    throw new Error("pagination does not terminate");
  };

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    await dropTables();
  });

  afterAll(async () => {
    const db = testDbService.database;
    await dropTables();
    await db.execute(sql`DELETE FROM data_projets_consolides.labels_methodes`);
    await db.execute(sql`REFRESH MATERIALIZED VIEW data_projets_consolides.labels_seuil_provisoire_materialise`);
    await db.delete(refPerimetres);
    await db.delete(refCommunes);
    await db.delete(refGroupements);
    await teardownTestModule(testDbService, module);
  }, 30000);

  describe("where the ETL has not built the base", () => {
    it("answers 503 instead of failing on a missing relation", async () => {
      const fresh = new ConsultationService(testDbService);
      await expect(fresh.projets({ limit: 10 })).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(fresh.synthese(PARIS)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe("with the base", () => {
    beforeAll(async () => {
      const db = testDbService.database;
      for (const ddl of DDL) await db.execute(ddl);

      await insertProjet(ECOLE, "Rénovation de l'école", PARIS, "dgcl", { budget: 200000, departement: "75" });
      await insertProjet(ECOLE_DOUBLON, "Renovation de l'ecole", PARIS, "fonds-vert", { departement: "75" });
      await insertProjet(STATION, "Station d'épuration", PARIS, "agences-eau", { budget: 100000 });
      await insertProjet(SANS_LABELS, "x", PARIS, "decp");
      await insertProjet(PISTE, "Piste cyclable", EPCI, "dgcl", { departement: "01|38" });
      await insertProjet(MARE, "Restauration de la mare", COMMUNE_AIN, "agences-eau");
      await insertProjet(SANS_SIREN, "Projet sans collectivité", null, "decp");

      await insertFinancement(ECOLE, "DETR", "2023-01-01", 80000, "Obtenu");
      await insertFinancement(ECOLE_DOUBLON, "Fonds Vert", null, null, "Obtenu");
      await insertFinancement(STATION, "Agence de l'eau", "2022-06-15", 50000, "Payé");
      await insertFinancement(STATION, "Agence de l'eau", "2022-09-01", 10000, "Refusé");
      await insertFinancement(PISTE, "DSIL", "2024-01-01", 30000, "Obtenu");

      await db.execute(sql`DELETE FROM data_projets_consolides.labels_methodes`);
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_methodes (id, methode) VALUES (1, ${LABELS_METHODE})`,
      );
      for (const [code, famille, label] of REFERENTIEL) {
        await db.execute(sql`
          INSERT INTO data_projets_consolides.labels_referentiel (methode_id, code, famille, label)
          VALUES (1, ${code}, ${famille}, ${label})`);
      }
      await insertLabels(ECOLE, { 1: 93, 10: 80, 20: 88, 30: 90 }, [ECOLE, ECOLE_DOUBLON]);
      await insertLabels(STATION, { 2: 90, 1: 60, 10: 70 }, [STATION]);
      await insertLabels(PISTE, { 3: 95, 11: 60 }, [PISTE]);
      await insertLabels(MARE, { 2: 70, 10: 90 }, [MARE]);
      await insertLabels(SANS_SIREN, { 3: 80, 10: 90 }, [SANS_SIREN]);
      await db.execute(sql`REFRESH MATERIALIZED VIEW data_projets_consolides.labels_seuil_provisoire_materialise`);

      await db.insert(refGroupements).values({ siren: EPCI, nom: "CC Test", type: "CC", population: 20000 });
      await db.insert(refCommunes).values([
        {
          codeInsee: "01001",
          siren: COMMUNE_AIN,
          nom: "Commune de l'Ain",
          codeDepartement: "01",
          codeRegion: "84",
          population: 800,
        },
        {
          codeInsee: "01002",
          siren: "210100020",
          nom: "Commune sans projet",
          codeDepartement: "01",
          codeRegion: "84",
        },
        { codeInsee: "75056", siren: PARIS, nom: "Paris", codeDepartement: "75", codeRegion: "11" },
      ]);
      await db.insert(refPerimetres).values({ sirenGroupement: EPCI, codeInseeCommune: "01001" });

      service = new ConsultationService(testDbService);
    });

    describe("projetsCollectivite", () => {
      it("groups exact duplicates at read time without losing their provenance", async () => {
        const result = await service.projetsCollectivite(PARIS, { limit: 50 });

        expect(result.total).toBe(3);
        expect(result.nextCursor).toBeNull();
        expect(result.data.map((p) => p.nom)).toEqual(["Rénovation de l'école", "Station d'épuration", "x"]);

        const ecole = result.data[0];
        expect(ecole.nbLignesRegroupees).toBe(2);
        expect(ecole.sources).toEqual([
          { source: "dgcl", idSource: ECOLE, role: "inchange" },
          { source: "fonds-vert", idSource: ECOLE_DOUBLON, role: "inchange" },
        ]);
        expect(ecole.financements.map((f) => f.source).sort()).toEqual(["DETR", "Fonds Vert"]);
      });

      it("serves the v0.2.0 projection with provisional labels and financements, no internal id", async () => {
        const { data } = await service.projetsCollectivite(PARIS, { limit: 50 });
        const ecole = data[0];

        expect(ecole).not.toHaveProperty("id");
        expect(ecole).toMatchObject({
          collectiviteResponsableSiren: PARIS,
          budgetPrevisionnel: 200000,
          dateDebut: "2023-03-01",
          territoireDepartements: ["75"],
          ouverture: "ouvert",
        });
        expect(ecole.labels).toMatchObject({
          provisoire: true,
          methode: LABELS_METHODE,
          classificationThematiques: ["Bâtiments publics"],
          nature: "Projet opérationnel",
          natureConfiance: 0.8,
          probabiliteTe: { global: 0.88 },
          budgetVert: { attenuation: "favorable" },
        });
        expect(ecole.financements).toContainEqual({
          source: "DETR",
          referenceExterne: null,
          dateAttribution: "2023-01-01",
          montantDemande: null,
          montantAttribue: 80000,
          statut: "Obtenu",
        });
      });

      it("returns labels null for a project that could not be classified", async () => {
        const { data } = await service.projetsCollectivite(PARIS, { limit: 50 });
        expect(data.find((p) => p.nom === "x")?.labels).toBeNull();
      });

      it("pages by cursor without repeating or dropping a project", async () => {
        const first = await service.projetsCollectivite(PARIS, { limit: 1 });
        expect(first.data).toHaveLength(1);
        expect(first.nextCursor).not.toBeNull();

        const all = await walk((cursor) => service.projetsCollectivite(PARIS, { limit: 1, cursor }));
        expect(all.map((p) => p.nom)).toEqual(["Rénovation de l'école", "Station d'épuration", "x"]);
      });

      it("filters by source, keeping a group as soon as one of its lines matches", async () => {
        const result = await service.projetsCollectivite(PARIS, { limit: 50, source: "fonds-vert" });
        expect(result.total).toBe(1);
        expect(result.data[0].nom).toBe("Rénovation de l'école");
        expect(result.data[0].nbLignesRegroupees).toBe(2);
      });

      it("filters by thematique, millesime and nature", async () => {
        const noms = async (filters: object) =>
          (await service.projetsCollectivite(PARIS, { limit: 50, ...filters })).data.map((p) => p.nom);

        expect(await noms({ thematique: "Assainissement" })).toEqual(["Station d'épuration"]);
        expect(await noms({ millesime: 2023 })).toEqual(["Rénovation de l'école"]);
        expect(await noms({ millesime: 2019 })).toEqual([]);
        expect(await noms({ nature: "Projet opérationnel" })).toEqual(["Rénovation de l'école", "Station d'épuration"]);
        expect(await noms({ thematique: "Bâtiments publics", millesime: 2022 })).toEqual(["Station d'épuration"]);
      });

      it("rejects a malformed SIREN or cursor with a 400", async () => {
        await expect(service.projetsCollectivite("123", { limit: 50 })).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.projetsCollectivite(PARIS, { limit: 50, cursor: "###" })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });

      it("returns an empty page for a collectivity without project", async () => {
        await expect(service.projetsCollectivite("999999999", { limit: 50 })).resolves.toEqual({
          data: [],
          limit: 50,
          nextCursor: null,
          total: 0,
        });
      });
    });

    describe("projets (bulk)", () => {
      const TOUS = [
        "Piste cyclable",
        "Restauration de la mare",
        "Rénovation de l'école",
        "Station d'épuration",
        "x",
        "Projet sans collectivité",
      ];

      it("serves the whole base in one page, projects without SIREN last", async () => {
        const result = await service.projets({ limit: 100 });
        expect(result.data.map((p) => p.nom)).toEqual(TOUS);
        expect(result.nextCursor).toBeNull();
      });

      it.each([1, 2, 3, 5, 6])("walks the whole base by pages of %i, each project exactly once", async (limit) => {
        const all = await walk((cursor) => service.projets({ limit, cursor }));
        expect(all.map((p) => p.nom)).toEqual(TOUS);
      });

      it("never returns a cursor on the last page", async () => {
        const page = await service.projets({ limit: 6 });
        expect(page.data).toHaveLength(6);
        expect(page.nextCursor).toBeNull();
      });

      it("applies the filters across collectivities, pagination included", async () => {
        const all = await walk((cursor) => service.projets({ limit: 1, cursor, source: "agences-eau" }));
        expect(all.map((p) => p.nom)).toEqual(["Restauration de la mare", "Station d'épuration"]);

        const mobilite = await walk((cursor) => service.projets({ limit: 1, cursor, thematique: "Mobilité douce" }));
        expect(mobilite.map((p) => p.nom)).toEqual(["Piste cyclable", "Projet sans collectivité"]);

        expect((await service.projets({ limit: 10, millesime: 2024 })).data.map((p) => p.nom)).toEqual([
          "Piste cyclable",
        ]);
      });

      it("rejects a malformed cursor with a 400", async () => {
        await expect(service.projets({ limit: 10, cursor: "###" })).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe("synthese", () => {
      it("aggregates granted amounts by financing source and year, at the financing grain", async () => {
        const synthese = await service.synthese(PARIS);

        expect(synthese.financementsParSourceEtAnnee).toEqual([
          // the refused line counts as a financing but not in the granted amount
          { source: "Agence de l'eau", annee: 2022, nbFinancements: 2, montantAttribue: 50000 },
          { source: "DETR", annee: 2023, nbFinancements: 1, montantAttribue: 80000 },
          { source: "Fonds Vert", annee: null, nbFinancements: 1, montantAttribue: 0 },
        ]);
        expect(synthese.montantAttribueTotal).toBe(130000);
        expect(synthese.nbFinancements).toBe(4);
      });

      it("counts projects after grouping and names the collectivity", async () => {
        const synthese = await service.synthese(PARIS);
        expect(synthese).toMatchObject({ siren: PARIS, nom: "Paris", nbProjets: 3, nbLignes: 4 });
        expect(synthese.labels).toEqual({ provisoire: true, methode: LABELS_METHODE });
      });

      it("flags the completeness of each source and warns about the incomplete ones", async () => {
        const synthese = await service.synthese(PARIS);

        expect(synthese.completudeParSource).toContainEqual({
          source: "Fonds Vert",
          nbFinancements: 1,
          tauxMontantRenseigne: 0,
          tauxDateRenseignee: 0,
        });
        expect(synthese.completudeParSource).toContainEqual({
          source: "DETR",
          nbFinancements: 1,
          tauxMontantRenseigne: 1,
          tauxDateRenseignee: 1,
        });
        expect(synthese.avertissements.filter((a) => a.startsWith("Fonds Vert"))).toHaveLength(1);
        expect(synthese.avertissements.some((a) => a.startsWith("DETR"))).toBe(false);
      });

      it("breaks down by thematique, a duplicated project counting once", async () => {
        const synthese = await service.synthese(PARIS);
        expect(synthese.parThematique).toEqual([
          { thematique: "Bâtiments publics", nbProjets: 2, montantAttribue: 130000 },
          { thematique: "Assainissement", nbProjets: 1, montantAttribue: 50000 },
        ]);
      });

      it("computes the financing rate on the projects that have both a budget and a granted amount", async () => {
        const { tauxFinancement } = await service.synthese(PARIS);
        expect(tauxFinancement).toEqual({
          nbProjetsComparables: 2,
          montantAttribue: 130000,
          budgetPrevisionnel: 300000,
          taux: 0.4333,
        });
      });

      it("returns an empty synthesis for an unknown collectivity", async () => {
        const synthese = await service.synthese("999999999");
        expect(synthese).toMatchObject({
          nom: null,
          nbProjets: 0,
          nbFinancements: 0,
          montantAttribueTotal: 0,
          financementsParSourceEtAnnee: [],
          parThematique: [],
        });
        expect(synthese.tauxFinancement.taux).toBeNull();
      });

      it("rejects a malformed SIREN with a 400", async () => {
        await expect(service.synthese("abc")).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe("collectivites", () => {
      it("lists the communes and groupings of a department with their indicators", async () => {
        const result = await service.collectivites({ departement: "01", limit: 50 });

        expect(result.data).toEqual([
          {
            siren: EPCI,
            nom: "CC Test",
            type: "CC",
            population: 20000,
            nbProjets: 1,
            nbFinancements: 1,
            montantAttribueTotal: 30000,
            principalesThematiques: [{ thematique: "Mobilité douce", nbProjets: 1, montantAttribue: 30000 }],
          },
          {
            siren: COMMUNE_AIN,
            nom: "Commune de l'Ain",
            type: "commune",
            population: 800,
            nbProjets: 1,
            nbFinancements: 0,
            montantAttribueTotal: 0,
            principalesThematiques: [{ thematique: "Assainissement", nbProjets: 1, montantAttribue: 0 }],
          },
          {
            siren: "210100020",
            nom: "Commune sans projet",
            type: "commune",
            population: null,
            nbProjets: 0,
            nbFinancements: 0,
            montantAttribueTotal: 0,
            principalesThematiques: [],
          },
        ]);
        expect(result.nextCursor).toBeNull();
        expect(result.labels).toEqual({ provisoire: true, methode: LABELS_METHODE });
      });

      it("lists by region", async () => {
        const result = await service.collectivites({ region: "11", limit: 50 });
        expect(result.data.map((c) => c.siren)).toEqual([PARIS]);
        expect(result.data[0].nbProjets).toBe(3);
      });

      it("pages by SIREN cursor", async () => {
        const first = await service.collectivites({ departement: "01", limit: 2 });
        expect(first.data.map((c) => c.siren)).toEqual([EPCI, COMMUNE_AIN]);
        expect(first.nextCursor).toBe(COMMUNE_AIN);

        const second = await service.collectivites({ departement: "01", limit: 2, cursor: first.nextCursor! });
        expect(second.data.map((c) => c.siren)).toEqual(["210100020"]);
        expect(second.nextCursor).toBeNull();
      });

      it("returns an empty list for a territory without collectivity", async () => {
        await expect(service.collectivites({ departement: "99", limit: 50 })).resolves.toMatchObject({
          data: [],
          nextCursor: null,
        });
      });

      it.each([
        ["neither departement nor region", {}],
        ["both", { departement: "01", region: "84" }],
        ["a malformed departement", { departement: "Ain" }],
        ["a malformed region", { region: "x" }],
        ["a malformed cursor", { departement: "01", cursor: "abc" }],
      ])("rejects %s with a 400", async (_label, params) => {
        await expect(service.collectivites({ limit: 50, ...params })).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });
});
