import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { currentEnv } from "@/shared/utils/currentEnv";

dotenv.config({ path: `.env.${currentEnv}` });

export default defineConfig({
  schema: [
    "./src/database/schema.ts",
    "./src/database/referentiel-schema.ts",
    "./src/database/plans-fiches-schema.ts",
    "./src/database/tet-schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:mypassword@localhost:5432/testdb",
  },
});
