import { parse } from "csv-parse";
import * as fs from "fs";
import createClient from "openapi-fetch";
import type { paths } from "@test/generated-types";
import { config } from "dotenv";
import * as path from "path";

interface CsvRecord {
  name: string;
  description: string;
  subtitle: string;
  logoUrl: string;
  redirectionUrl: string;
  redirectionLabel: string;
  isListed: string;
  iframeUrl?: string;
  extendLabel?: string;
}

// Load environment variables from .env file
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
config({ path: path.resolve(__dirname, "../.env") });

if (!process.env.SERVICE_MANAGEMENT_API_KEY) {
  console.error("Please set SERVICE_MANAGEMENT_API_KEY environment variable");
  process.exit(1);
}

const baseUrl = "http://localhost:3000";
const apiKey = process.env.SERVICE_MANAGEMENT_API_KEY;

const apiClient = createClient<paths>({
  baseUrl,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
});

async function importServices(csvFilePath: string) {
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  fs.createReadStream(csvFilePath).pipe(parser);

  for await (const record of parser as AsyncIterable<CsvRecord>) {
    const service = {
      name: record.name,
      description: record.description,
      sousTitre: record.subtitle,
      logoUrl: record.logoUrl,
      redirectionUrl: record.redirectionUrl,
      redirectionLabel: record.redirectionLabel,
      iframeUrl: record.iframeUrl ?? undefined,
      extendLabel: record.extendLabel ?? undefined,
    };

    try {
      const { data, error } = await apiClient.POST("/services", { body: service });

      if (error) {
        console.error(`Failed to import service ${service.name}:`, error);
        continue;
      }

      console.log(`Imported: ${data?.name} (${data?.id})`);
    } catch (error) {
      console.error(`Error importing service ${service.name}:`, error);
    }
  }
}

// Check if CSV file path is provided
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error("Please provide a CSV file path");
  process.exit(1);
}

// Run the import
void importServices(csvFilePath);
