import { execFileSync, execSync } from "child_process";
import * as path from "path";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";

// Exercises the real bash script against two databases of one PostgreSQL container
// ("prod" source, "staging" target), both migrated with the real drizzle migrations.

const SCRIPT = path.join(__dirname, "sync-data-tet.sh");
const TARGET_DB = "staging_db";

const PROD_FICHE = "0199aaaa-0000-7000-8000-000000000001";
const PROD_PLAN = "0199aaaa-0000-7000-8000-0000000000aa";
const STALE_FICHE = "0199bbbb-0000-7000-8000-000000000002";

const SCORES = {
  thematiques: [{ label: "Mobilité", score: 0.9 }],
  sites: [{ label: "Voirie", score: 0.6 }],
  interventions: [],
};

jest.setTimeout(180_000);

describe("sync-data-tet.sh", () => {
  let container: StartedPostgreSqlContainer;
  let sourceUrl: string;
  let targetUrl: string;
  let source: Client;
  let target: Client;

  const urlFor = (db: string) => {
    const url = new URL(container.getConnectionUri());
    url.pathname = `/${db}`;
    return url.toString();
  };

  const run = (env: Record<string, string> = {}) => {
    try {
      const stdout = execFileSync("bash", [SCRIPT], {
        env: {
          ...process.env,
          FROM_DB_URL: sourceUrl,
          TO_DB_URL: targetUrl,
          EXPECTED_TO_DB_NAME: TARGET_DB,
          MIN_SOURCE_FICHES: "1",
          ...env,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { status: 0, output: stdout };
    } catch (e) {
      const err = e as { status: number; stdout: string; stderr: string };
      return { status: err.status, output: `${err.stdout}\n${err.stderr}` };
    }
  };

  const targetFicheIds = async () =>
    (await target.query<{ id: string }>("select id from data_tet.fiches_action order by id")).rows.map((r) => r.id);

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:15-alpine").withDatabase("prod_db").start();
    const admin = new Client({ connectionString: container.getConnectionUri() });
    await admin.connect();
    await admin.query(`create database ${TARGET_DB}`);
    await admin.end();

    sourceUrl = urlFor("prod_db");
    targetUrl = urlFor(TARGET_DB);
    for (const DATABASE_URL of [sourceUrl, targetUrl]) {
      execSync("pnpm db:migrate:drizzle", { env: { ...process.env, DATABASE_URL }, stdio: "pipe" });
    }

    source = new Client({ connectionString: sourceUrl });
    target = new Client({ connectionString: targetUrl });
    await source.connect();
    await target.connect();
  });

  afterAll(async () => {
    await source?.end();
    await target?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    for (const db of [source, target]) {
      await db.query(
        "truncate data_tet.fiches_action_to_plans, data_tet.external_ids, data_tet.fiches_action, data_tet.plans_transition",
      );
    }

    // Source: one classified fiche, linked to a plan, with awkward values (tabs, newlines, backslashes).
    await source.query(
      `insert into data_tet.fiches_action
         (id, nom, description, leviers_sgpe, classification_thematiques, classification_scores, source_metadata)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        PROD_FICHE,
        "Pistes cyclables",
        'ligne 1\nligne 2\tavec tab \\ et "guillemets"',
        ["Vélo", "Covoiturage"],
        ["Mobilité"],
        JSON.stringify(SCORES),
        JSON.stringify({ porteur: "Service mobilités" }),
      ],
    );
    await source.query("insert into data_tet.plans_transition (id, nom, type) values ($1, 'PCAET 2024', 'PCAET')", [
      PROD_PLAN,
    ]);
    await source.query(
      "insert into data_tet.fiches_action_to_plans (fiche_action_id, plan_transition_id) values ($1, $2)",
      [PROD_FICHE, PROD_PLAN],
    );
    await source.query(
      `insert into data_tet.external_ids (objet_id, service_type, objet_type, external_id)
       values ($1, 'TeT', 'fiche_action', '144374'), ($2, 'TeT', 'plan_transition', '6819')`,
      [PROD_FICHE, PROD_PLAN],
    );

    // Target: a fiche created on staging yesterday, holding an external id that production reuses.
    await target.query("insert into data_tet.fiches_action (id, nom) values ($1, 'Fiche de test staging')", [
      STALE_FICHE,
    ]);
    await target.query(
      `insert into data_tet.external_ids (objet_id, service_type, objet_type, external_id)
       values ($1, 'TeT', 'fiche_action', '144374')`,
      [STALE_FICHE],
    );
  });

  it("replaces the target content with the source content, labels included", async () => {
    const result = run();

    expect(result.output).toContain("Sync complete");
    expect(result.status).toBe(0);

    const { rows } = await target.query(
      `select id, description, leviers_sgpe, classification_scores, source_metadata from data_tet.fiches_action`,
    );
    expect(rows).toEqual([
      {
        id: PROD_FICHE,
        description: 'ligne 1\nligne 2\tavec tab \\ et "guillemets"',
        leviers_sgpe: ["Vélo", "Covoiturage"],
        classification_scores: SCORES,
        source_metadata: { porteur: "Service mobilités" },
      },
    ]);

    // The reused external id now resolves to the production fiche, not the stale staging one.
    const mapping = await target.query(
      "select objet_id from data_tet.external_ids where objet_type = 'fiche_action' and external_id = '144374'",
    );
    expect(mapping.rows).toEqual([{ objet_id: PROD_FICHE }]);

    const links = await target.query("select fiche_action_id, plan_transition_id from data_tet.fiches_action_to_plans");
    expect(links.rows).toEqual([{ fiche_action_id: PROD_FICHE, plan_transition_id: PROD_PLAN }]);
  });

  it("never writes to the source", async () => {
    run();

    const { rows } = await source.query("select id from data_tet.fiches_action");
    expect(rows).toEqual([{ id: PROD_FICHE }]);
  });

  it("refuses a target whose database name is not the expected one", async () => {
    const result = run({ EXPECTED_TO_DB_NAME: "some_other_db" });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Refusing to sync");
    expect(await targetFicheIds()).toEqual([STALE_FICHE]);
  });

  it("refuses to sync a database onto itself", async () => {
    const result = run({ FROM_DB_URL: targetUrl });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("Refusing to sync");
    expect(await targetFicheIds()).toEqual([STALE_FICHE]);
  });

  it("refuses a source that looks empty", async () => {
    const result = run({ MIN_SOURCE_FICHES: "1000" });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("below the minimum");
    expect(await targetFicheIds()).toEqual([STALE_FICHE]);
  });

  it("does not touch the target in dry-run mode", async () => {
    const result = run({ DRY_RUN: "true" });

    expect(result.status).toBe(0);
    expect(result.output).toContain("Dry run");
    expect(await targetFicheIds()).toEqual([STALE_FICHE]);
  });

  describe("schema drift (staging runs ahead of production)", () => {
    afterEach(async () => {
      await target.query("alter table data_tet.fiches_action drop column if exists added_on_staging");
      await target.query("alter table data_tet.fiches_action drop column if exists required_on_staging");
      await target.query("alter table data_tet.fiches_action drop constraint if exists nom_not_pistes");
      await source.query("alter table data_tet.fiches_action drop column if exists only_in_prod");
    });

    it("tolerates a column that only exists on the target", async () => {
      await target.query("alter table data_tet.fiches_action add column added_on_staging text");

      expect(run().status).toBe(0);
      expect(await targetFicheIds()).toEqual([PROD_FICHE]);
    });

    it("skips, with a warning, a column that only exists on the source", async () => {
      await source.query("alter table data_tet.fiches_action add column only_in_prod text default 'x'");

      const result = run();

      expect(result.status).toBe(0);
      expect(result.output).toContain("only_in_prod exists on the source but not on the target");
      expect(await targetFicheIds()).toEqual([PROD_FICHE]);
    });

    it("stops before truncating when the target requires a column the source cannot fill", async () => {
      await target.query("alter table data_tet.fiches_action add column required_on_staging text");
      await target.query("update data_tet.fiches_action set required_on_staging = 'x'");
      await target.query("alter table data_tet.fiches_action alter column required_on_staging set not null");

      const result = run();

      expect(result.status).not.toBe(0);
      expect(result.output).toContain("required_on_staging");
      expect(await targetFicheIds()).toEqual([STALE_FICHE]);
    });

    it("rolls back to the previous content when the load itself fails", async () => {
      await target.query(
        "alter table data_tet.fiches_action add constraint nom_not_pistes check (nom <> 'Pistes cyclables') not valid",
      );

      const result = run();

      expect(result.status).not.toBe(0);
      expect(await targetFicheIds()).toEqual([STALE_FICHE]);
    });
  });
});
