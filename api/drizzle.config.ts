import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load the appropriate .env file based on NODE_ENV
const env = process.env.NODE_ENV ?? "development";
dotenv.config({ path: `.env.${env}` });

export default defineConfig({
  schema: "./src/database/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:mypassword@localhost:5432/testdb",
  },
});
