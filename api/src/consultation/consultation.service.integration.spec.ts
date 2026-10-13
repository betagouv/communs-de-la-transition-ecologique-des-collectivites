import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TestingModule } from "@nestjs/testing";
import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { teardownTestModule, testModule } from "@test/helpers/test-module";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { refCommunes, refGroupements, refPerimetres, services } from "@database/schema";
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
const LYON = "216901231";
const SIREN_VIVIER = "219999990";
const TURGOT = "Turgot"; // holds the interne_etat scope, granted by migration 0057 (applied below)
const SANS_SCOPE = "Recoco"; // no `services` row: no data scope

const GRANT_TURGOT = readFileSync(join(__dirname, "../../drizzle/0057_turgot_interne_etat.sql"), "utf8");

const uuid = (n: number) => `00000000-0000-5000-8000-${String(n).padStart(12, "0")}`;
const ECOLE = uuid(1); // Paris, dgcl, DETR 2023
const ECOLE_DOUBLON = uuid(2); // Paris, exact duplicate of ECOLE seen by fonds-vert, interne
const STATION = uuid(3); // Paris, agences-eau, 2022, public_sans_licence
const SANS_LABELS = uuid(4); // Paris, title too short to be classified
const PISTE = uuid(5); // EPCI
const MARE = uuid(6); // commune de l'Ain
const SANS_SIREN = uuid(7);

// Data access: lines with a trace in a source not exposed to the caller (no scope).
const ECOLE_TET = uuid(0); // exact duplicate of ECOLE seen by TeT: would carry the group (smallest id)
const FICHE_TET = uuid(8); // Paris, TeT only
const FUSION_PVD = uuid(9); // Paris, one line fused from dgcl and ANCT PVD traces
const AIN_ACV = uuid(14); // commune de l'Ain, ANCT ACV
const SANS_SIREN_VILLAGES = uuid(15);
const VIVIER = uuid(16); // only project of its collectivity, COP vivier
// `interne` lines (Lyon): served only to a caller holding the interne_etat scope.
const CRTE = uuid(11);
const FV_INTERNE = uuid(12);
const DGCL_INTERNE = uuid(13);

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

  let traceSeq = 1000;
  const insertProjet = async (
    id: string,
    nom: string,
    siren: string | null,
    source: string,
    extra: { budget?: number; departement?: string; ouverture?: string; autresSources?: string[] } = {},
  ) => {
    const db = testDbService.database;
    const sources = [source, ...(extra.autresSources ?? [])];
    await db.execute(sql`
      INSERT INTO data_projets_consolides.projets
        (id, nom, collectivite_responsable_siren, ouverture, sources, budget_previsionnel, territoire_departement, date_debut)
      VALUES (${id}, ${nom}, ${siren}, ${extra.ouverture ?? "ouvert"}, ${`{${sources.join(",")}}`}::text[],
              ${extra.budget ?? null}, ${extra.departement ?? null}, '2023-03-01')`);
    for (const [i, s] of sources.entries()) {
      // a fused line carries one trace per source it was built from
      await db.execute(sql`
        INSERT INTO data_projets_consolides.projets_sources (projet_id, source, id_source, role)
        VALUES (${id}, ${s}, ${i === 0 ? id : uuid(traceSeq++)}, ${i === 0 ? "inchange" : "fusionne"})`);
    }
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
    await db.delete(services).where(eq(services.name, TURGOT));
    await teardownTestModule(testDbService, module);
  }, 30000);

  describe("where the ETL has not built the base", () => {
    it("answers 503 instead of failing on a missing relation", async () => {
      const fresh = new ConsultationService(testDbService);
      await expect(fresh.projets({ limit: 10 }, TURGOT)).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(fresh.synthese(PARIS, TURGOT)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe("with the base", () => {
    beforeAll(async () => {
      const db = testDbService.database;
      for (const ddl of DDL) await db.execute(ddl);

      await insertProjet(ECOLE, "Rénovation de l'école", PARIS, "dgcl", { budget: 200000, departement: "75" });
      await insertProjet(ECOLE_DOUBLON, "Renovation de l'ecole", PARIS, "fonds-vert", {
        departement: "75",
        ouverture: "interne",
      });
      await insertProjet(STATION, "Station d'épuration", PARIS, "agences-eau", {
        budget: 100000,
        ouverture: "public_sans_licence",
      });
      await insertProjet(SANS_LABELS, "x", PARIS, "decp");
      await insertProjet(PISTE, "Piste cyclable", EPCI, "dgcl", { departement: "01|38" });
      await insertProjet(MARE, "Restauration de la mare", COMMUNE_AIN, "agences-eau");
      await insertProjet(SANS_SIREN, "Projet sans collectivité", null, "decp");

      await insertProjet(ECOLE_TET, "Rénovation de l'école (TeT)", PARIS, "fiches-projets", { budget: 400000 });
      await insertProjet(FICHE_TET, "Fiche TeT", PARIS, "fiches-projets", { budget: 500000, departement: "75" });
      await insertProjet(FUSION_PVD, "Halle fusionnée", PARIS, "dgcl", {
        budget: 90000,
        autresSources: ["communs-pvd"],
      });
      await insertProjet(AIN_ACV, "Coeur de bourg", COMMUNE_AIN, "communs-acv");
      await insertProjet(SANS_SIREN_VILLAGES, "Village sans collectivité", null, "villages-avenir");
      await insertProjet(VIVIER, "Vivier COP", SIREN_VIVIER, "communs-vivier-cop");
      await insertProjet(CRTE, "Contrat CRTE", LYON, "communs-crte", { ouverture: "interne" });
      await insertProjet(FV_INTERNE, "Fonds Vert interne", LYON, "fonds-vert", { ouverture: "interne" });
      await insertProjet(DGCL_INTERNE, "Dotation interne", LYON, "dgcl", { ouverture: "interne" });

      await insertFinancement(ECOLE, "DETR", "2023-01-01", 80000, "Obtenu");
      await insertFinancement(ECOLE_DOUBLON, "Fonds Vert", null, null, "Obtenu");
      await insertFinancement(STATION, "Agence de l'eau", "2022-06-15", 50000, "Payé");
      await insertFinancement(STATION, "Agence de l'eau", "2022-09-01", 10000, "Refusé");
      await insertFinancement(PISTE, "DSIL", "2024-01-01", 30000, "Obtenu");
      await insertFinancement(ECOLE_TET, "Fonds Vert", "2023-05-01", 5000, "Obtenu");
      await insertFinancement(FICHE_TET, "Fonds Vert", "2023-05-01", 900000, "Obtenu");
      await insertFinancement(FUSION_PVD, "DETR", "2023-02-01", 70000, "Obtenu");
      await insertFinancement(AIN_ACV, "DSIL", "2024-01-01", 1000, "Obtenu");
      await insertFinancement(VIVIER, "DETR", "2024-01-01", 1000, "Obtenu");
      await insertFinancement(FV_INTERNE, "Fonds Vert", "2024-03-01", 250000, "Obtenu");

      await db.execute(sql`DELETE FROM data_projets_consolides.labels_methodes`);
      await db.execute(
        sql`INSERT INTO data_projets_consolides.labels_methodes (id, methode) VALUES (1, ${LABELS_METHODE})`,
      );
      for (const [code, famille, label] of REFERENTIEL) {
        await db.execute(sql`
          INSERT INTO data_projets_consolides.labels_referentiel (methode_id, code, famille, label)
          VALUES (1, ${code}, ${famille}, ${label})`);
      }
      await insertLabels(ECOLE, { 1: 93, 10: 80, 20: 88, 30: 90 }, [ECOLE, ECOLE_DOUBLON, ECOLE_TET]);
      await insertLabels(STATION, { 2: 90, 1: 60, 10: 70 }, [STATION]);
      await insertLabels(PISTE, { 3: 95, 11: 60 }, [PISTE]);
      await insertLabels(MARE, { 2: 70, 10: 90 }, [MARE]);
      await insertLabels(SANS_SIREN, { 3: 80, 10: 90 }, [SANS_SIREN]);
      await insertLabels(FICHE_TET, { 1: 90, 2: 90 }, [FICHE_TET]);
      await insertLabels(FUSION_PVD, { 1: 90 }, [FUSION_PVD]);
      await insertLabels(AIN_ACV, { 2: 90 }, [AIN_ACV]);
      await insertLabels(SANS_SIREN_VILLAGES, { 3: 90 }, [SANS_SIREN_VILLAGES]);
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
      // other suites empty `services`: re-apply the migration rather than rely on the run order
      await db.execute(sql.raw(GRANT_TURGOT));

      service = new ConsultationService(testDbService);
    });

    describe("data access by source", () => {
      const NON_EXPOSEES = ["fiches-projets", "communs-pvd", "communs-acv", "villages-avenir", "communs-vivier-cop"];
      const provenancesDe = (projets: ProjetConsultationDto[]) =>
        projets.flatMap((p) => p.provenances.map((x) => x.provenance));

      afterEach(async () => {
        await testDbService.database.delete(services).where(eq(services.name, "TeT"));
      });

      it("never serves a line traced in a source the caller has no scope for, in bulk", async () => {
        const all = await walk((cursor) => service.projets({ limit: 2, cursor }, TURGOT));
        const provenances = provenancesDe(all);
        for (const source of NON_EXPOSEES) expect(provenances).not.toContain(source);
        expect(all.map((p) => p.nom)).not.toContain("Halle fusionnée");
      });

      it("excludes the whole line as soon as one of its traces is restricted, not just the trace", async () => {
        const result = await service.projetsCollectivite(PARIS, { limit: 50, provenance: "dgcl" }, TURGOT);
        expect(result.data.map((p) => p.nom)).toEqual(["Rénovation de l'école"]);
        expect(result.total).toBe(1);
      });

      it("drops a restricted duplicate from its group, even when it would carry the group", async () => {
        const { data } = await service.projetsCollectivite(PARIS, { limit: 50 }, TURGOT);
        const ecole = data[0];
        expect(ecole.nom).toBe("Rénovation de l'école");
        expect(ecole.nbLignesRegroupees).toBe(2);
        expect(ecole.budgetPrevisionnel).toBe(200000);
        expect(ecole.financements.map((f) => f.montantAttribue)).not.toContain(5000);
      });

      it("finds nothing when filtering on a restricted provenance", async () => {
        const result = await service.projets({ limit: 10, provenance: "fiches-projets" }, TURGOT);
        expect(result).toMatchObject({ data: [], nextCursor: null });
      });

      it("treats a collectivity whose projects are all restricted as one without project", async () => {
        await expect(service.projetsCollectivite(SIREN_VIVIER, { limit: 50 }, TURGOT)).resolves.toMatchObject({
          data: [],
          total: 0,
        });
        await expect(service.synthese(SIREN_VIVIER, TURGOT)).resolves.toMatchObject({
          nbProjets: 0,
          nbFinancements: 0,
          montantAttribueTotal: 0,
          parThematique: [],
        });
      });

      it("serves CRTE, internal Fonds Vert and internal DGCL lines, with their ouverture", async () => {
        const { data, total } = await service.projetsCollectivite(LYON, { limit: 50 }, TURGOT);
        expect(total).toBe(3);
        expect(data.map((p) => [p.nom, p.ouverture, p.provenances[0].provenance])).toEqual([
          ["Contrat CRTE", "interne", "communs-crte"],
          ["Fonds Vert interne", "interne", "fonds-vert"],
          ["Dotation interne", "interne", "dgcl"],
        ]);
        expect((await service.synthese(LYON, TURGOT)).montantAttribueTotal).toBe(250000);
      });

      it("opens a restricted source to a service holding its scope, and only that one", async () => {
        await testDbService.database.insert(services).values({
          name: "TeT",
          description: "Territoires en Transitions",
          sousTitre: "TeT",
          logoUrl: "https://example.org/logo.png",
          redirectionUrl: "https://example.org",
          dataScopes: ["tet"],
        });

        const { data, total } = await service.projetsCollectivite(PARIS, { limit: 50 }, "TeT");
        expect(total).toBe(4);
        expect(data.map((p) => p.nom)).toEqual([
          "Rénovation de l'école (TeT)",
          "Station d'épuration",
          "x",
          "Fiche TeT",
        ]);
        expect(data[0].nbLignesRegroupees).toBe(2);
        expect(provenancesDe(data)).not.toContain("communs-pvd");
        expect(data.map((p) => p.ouverture)).not.toContain("interne");
      });
    });

    describe("data access by ouverture", () => {
      const turgotRow = async () => {
        const [row] = await testDbService.database.select().from(services).where(eq(services.name, TURGOT));
        return row;
      };

      it("migration 0057 grants Turgot interne_etat on an unlisted row, keeping its other scopes", async () => {
        const db = testDbService.database;
        expect(await turgotRow()).toMatchObject({ dataScopes: ["interne_etat"], isListed: false });

        await db
          .update(services)
          .set({ dataScopes: ["tet"] })
          .where(eq(services.name, TURGOT));
        await db.execute(sql.raw(GRANT_TURGOT));
        await db.execute(sql.raw(GRANT_TURGOT));
        expect((await turgotRow()).dataScopes).toEqual(["interne_etat", "tet"]);

        await db
          .update(services)
          .set({ dataScopes: ["interne_etat"] })
          .where(eq(services.name, TURGOT));
      });

      it("serves a caller without scope only open and public-without-licence lines, in bulk", async () => {
        const all = await walk((cursor) => service.projets({ limit: 2, cursor }, SANS_SCOPE));
        expect(new Set(all.map((p) => p.ouverture))).toEqual(new Set(["ouvert", "public_sans_licence"]));
        expect(all.map((p) => p.nom)).not.toEqual(expect.arrayContaining(["Fonds Vert interne"]));
        expect(all.map((p) => p.nom)).toContain("Station d'épuration");
      });

      it("drops an internal duplicate from its group: no line count, provenance or financement leaks", async () => {
        const { data } = await service.projetsCollectivite(PARIS, { limit: 50 }, SANS_SCOPE);
        const ecole = data[0];
        expect(ecole.nom).toBe("Rénovation de l'école");
        expect(ecole.nbLignesRegroupees).toBe(1);
        expect(ecole.provenances).toEqual([{ provenance: "dgcl", idSource: ECOLE, role: "inchange" }]);
        expect(ecole.financements.map((f) => f.source)).toEqual(["DETR"]);
      });

      it("keeps internal lines out of the aggregates", async () => {
        await expect(service.projetsCollectivite(LYON, { limit: 50 }, SANS_SCOPE)).resolves.toMatchObject({
          data: [],
          total: 0,
        });
        await expect(service.synthese(LYON, SANS_SCOPE)).resolves.toMatchObject({
          nbProjets: 0,
          montantAttribueTotal: 0,
        });
        const paris = await service.synthese(PARIS, SANS_SCOPE);
        expect(JSON.stringify(paris)).not.toContain("Fonds Vert");
      });

      it("serves internal lines to a caller holding interne_etat, restricted sources still excluded", async () => {
        const { data, total } = await service.projetsCollectivite(LYON, { limit: 50 }, TURGOT);
        expect(total).toBe(3);
        const all = await walk((cursor) => service.projets({ limit: 3, cursor }, TURGOT));
        expect(all.map((p) => p.ouverture)).toContain("interne");
        expect(all.flatMap((p) => p.provenances.map((x) => x.provenance))).not.toContain("fiches-projets");
        expect(data).toHaveLength(3);
      });
    });

    describe("projetsCollectivite", () => {
      it("groups exact duplicates at read time without losing their provenance", async () => {
        const result = await service.projetsCollectivite(PARIS, { limit: 50 }, TURGOT);

        expect(result.total).toBe(3);
        expect(result.nextCursor).toBeNull();
        expect(result.data.map((p) => p.nom)).toEqual(["Rénovation de l'école", "Station d'épuration", "x"]);

        const ecole = result.data[0];
        expect(ecole.nbLignesRegroupees).toBe(2);
        expect(ecole.provenances).toEqual([
          { provenance: "dgcl", idSource: ECOLE, role: "inchange" },
          { provenance: "fonds-vert", idSource: ECOLE_DOUBLON, role: "inchange" },
        ]);
        expect(ecole.financements.map((f) => f.source).sort()).toEqual(["DETR", "Fonds Vert"]);
      });

      it("serves the v0.2.0 projection with provisional labels and financements, no internal id", async () => {
        const { data } = await service.projetsCollectivite(PARIS, { limit: 50 }, TURGOT);
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
        const { data } = await service.projetsCollectivite(PARIS, { limit: 50 }, TURGOT);
        expect(data.find((p) => p.nom === "x")?.labels).toBeNull();
      });

      it("pages by cursor without repeating or dropping a project", async () => {
        const first = await service.projetsCollectivite(PARIS, { limit: 1 }, TURGOT);
        expect(first.data).toHaveLength(1);
        expect(first.nextCursor).not.toBeNull();

        const all = await walk((cursor) => service.projetsCollectivite(PARIS, { limit: 1, cursor }, TURGOT));
        expect(all.map((p) => p.nom)).toEqual(["Rénovation de l'école", "Station d'épuration", "x"]);
      });

      it("filters by provenance, keeping a group as soon as one of its lines matches", async () => {
        const result = await service.projetsCollectivite(PARIS, { limit: 50, provenance: "fonds-vert" }, TURGOT);
        expect(result.total).toBe(1);
        expect(result.data[0].nom).toBe("Rénovation de l'école");
        expect(result.data[0].nbLignesRegroupees).toBe(2);
      });

      it("filters by thematique, millesime and nature", async () => {
        const noms = async (filters: object) =>
          (await service.projetsCollectivite(PARIS, { limit: 50, ...filters }, TURGOT)).data.map((p) => p.nom);

        expect(await noms({ thematique: "Assainissement" })).toEqual(["Station d'épuration"]);
        expect(await noms({ millesime: 2023 })).toEqual(["Rénovation de l'école"]);
        expect(await noms({ millesime: 2019 })).toEqual([]);
        expect(await noms({ nature: "Projet opérationnel" })).toEqual(["Rénovation de l'école", "Station d'épuration"]);
        expect(await noms({ thematique: "Bâtiments publics", millesime: 2022 })).toEqual(["Station d'épuration"]);
      });

      it("rejects a malformed SIREN or cursor with a 400", async () => {
        await expect(service.projetsCollectivite("123", { limit: 50 }, TURGOT)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        await expect(service.projetsCollectivite(PARIS, { limit: 50, cursor: "###" }, TURGOT)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });

      it("returns an empty page for a collectivity without project", async () => {
        await expect(service.projetsCollectivite("999999999", { limit: 50 }, TURGOT)).resolves.toEqual({
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
        "Contrat CRTE",
        "Fonds Vert interne",
        "Dotation interne",
        "Rénovation de l'école",
        "Station d'épuration",
        "x",
        "Projet sans collectivité",
      ];

      it("serves the whole base in one page, projects without SIREN last", async () => {
        const result = await service.projets({ limit: 100 }, TURGOT);
        expect(result.data.map((p) => p.nom)).toEqual(TOUS);
        expect(result.nextCursor).toBeNull();
      });

      it.each([1, 2, 3, 5, 9])("walks the whole base by pages of %i, each project exactly once", async (limit) => {
        const all = await walk((cursor) => service.projets({ limit, cursor }, TURGOT));
        expect(all.map((p) => p.nom)).toEqual(TOUS);
      });

      it("never returns a cursor on the last page", async () => {
        const page = await service.projets({ limit: 9 }, TURGOT);
        expect(page.data).toHaveLength(9);
        expect(page.nextCursor).toBeNull();
      });

      it("applies the filters across collectivities, pagination included", async () => {
        const all = await walk((cursor) => service.projets({ limit: 1, cursor, provenance: "agences-eau" }, TURGOT));
        expect(all.map((p) => p.nom)).toEqual(["Restauration de la mare", "Station d'épuration"]);

        const mobilite = await walk((cursor) =>
          service.projets({ limit: 1, cursor, thematique: "Mobilité douce" }, TURGOT),
        );
        expect(mobilite.map((p) => p.nom)).toEqual(["Piste cyclable", "Projet sans collectivité"]);

        expect((await service.projets({ limit: 10, millesime: 2024 }, TURGOT)).data.map((p) => p.nom)).toEqual([
          "Piste cyclable",
          "Fonds Vert interne",
        ]);
      });

      it("rejects a malformed cursor with a 400", async () => {
        await expect(service.projets({ limit: 10, cursor: "###" }, TURGOT)).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe("synthese", () => {
      it("aggregates granted amounts by financing source and year, at the financing grain", async () => {
        const synthese = await service.synthese(PARIS, TURGOT);

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
        const synthese = await service.synthese(PARIS, TURGOT);
        expect(synthese).toMatchObject({ siren: PARIS, nom: "Paris", nbProjets: 3, nbLignes: 4 });
        expect(synthese.labels).toEqual({ provisoire: true, methode: LABELS_METHODE });
      });

      it("flags the completeness of each source and warns about the incomplete ones", async () => {
        const synthese = await service.synthese(PARIS, TURGOT);

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
        const synthese = await service.synthese(PARIS, TURGOT);
        expect(synthese.parThematique).toEqual([
          { thematique: "Bâtiments publics", nbProjets: 2, montantAttribue: 130000 },
          { thematique: "Assainissement", nbProjets: 1, montantAttribue: 50000 },
        ]);
      });

      it("computes the financing rate on the projects that have both a budget and a granted amount", async () => {
        const { tauxFinancement } = await service.synthese(PARIS, TURGOT);
        expect(tauxFinancement).toEqual({
          nbProjetsComparables: 2,
          montantAttribue: 130000,
          budgetPrevisionnel: 300000,
          taux: 0.4333,
        });
      });

      it("returns an empty synthesis for an unknown collectivity", async () => {
        const synthese = await service.synthese("999999999", TURGOT);
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
        await expect(service.synthese("abc", TURGOT)).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe("collectivites", () => {
      it("lists the communes and groupings of a department with their indicators", async () => {
        const result = await service.collectivites({ departement: "01", limit: 50 }, TURGOT);

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
        const result = await service.collectivites({ region: "11", limit: 50 }, TURGOT);
        expect(result.data.map((c) => c.siren)).toEqual([PARIS]);
        expect(result.data[0].nbProjets).toBe(3);
      });

      it("pages by SIREN cursor", async () => {
        const first = await service.collectivites({ departement: "01", limit: 2 }, TURGOT);
        expect(first.data.map((c) => c.siren)).toEqual([EPCI, COMMUNE_AIN]);
        expect(first.nextCursor).toBe(COMMUNE_AIN);

        const second = await service.collectivites({ departement: "01", limit: 2, cursor: first.nextCursor! }, TURGOT);
        expect(second.data.map((c) => c.siren)).toEqual(["210100020"]);
        expect(second.nextCursor).toBeNull();
      });

      it("returns an empty list for a territory without collectivity", async () => {
        await expect(service.collectivites({ departement: "99", limit: 50 }, TURGOT)).resolves.toMatchObject({
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
        await expect(service.collectivites({ limit: 50, ...params }, TURGOT)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });
    });
  });
});
