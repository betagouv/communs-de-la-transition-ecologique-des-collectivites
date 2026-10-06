// Génère une clé d'API partenaire et stocke son empreinte dans api_keys.
// La clé en clair n'est affichée qu'une seule fois, jamais stockée ni loguée ailleurs.
//
// Usage :
//   DATABASE_URL=postgres://... pnpm create-api-key --service TeT --name "TeT — Mehdi (poste local)" [--env prod|stg] [--read-only]
//
// --read-only : la clé n'ouvre que GET/HEAD/OPTIONS (403 sur toute écriture).
//
// Révocation : UPDATE api_keys SET active = false WHERE name = '...';

import { randomBytes, createHash } from "crypto";
import { Client } from "pg";

const SERVICES = ["MEC", "TeT", "Recoco", "UrbanVitaliz", "SosPonts", "FondVert", "DashboardTE"];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const service = arg("service");
  const name = arg("name");
  const env = arg("env") ?? "prod";
  const readOnly = process.argv.includes("--read-only");

  if (!service || !SERVICES.includes(service) || !name || !["prod", "stg"].includes(env)) {
    console.error(
      `Usage: pnpm create-api-key --service <${SERVICES.join("|")}> --name "<détenteur>" [--env prod|stg] [--read-only]`,
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL requis.");
    process.exit(1);
  }

  const key = `ck_${env}_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(key).digest("hex");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO api_keys (id, key_hash, service_type, name, read_only)
       VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id`,
      [keyHash, service, name, readOnly],
    );
    console.log(
      `Clé créée (id ${rows[0].id}) — service ${service}, détenteur « ${name} »${readOnly ? ", lecture seule" : ""}\n`,
    );
    console.log(`  ${key}\n`);
    console.log("⚠️  Affichée une seule fois : transmettre par canal sûr, seule l'empreinte est en base.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
