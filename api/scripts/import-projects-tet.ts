import { parse } from "csv-parse";
import * as fs from "fs";
import createClient from "openapi-fetch";
import type { paths } from "@test/generated-types";
import { config } from "dotenv";
import * as path from "path";
import { Competences, Leviers } from "@/shared/types";
import { leviers } from "@/shared/const/leviers";
import { competences } from "@/shared/const/competences-list";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { ProjetStatus, projetStatusEnum } from "@database/schema";

config({ path: path.resolve(__dirname, "../.env") });

interface CsvRecord {
  tet_id: string;
  nom: string;
  description: string;
  budget: string;
  forecasted_start_date: string;
  project_status: string;
  commune: string;
  insee_code: string;
  leviers: string;
  competences: string;
}

async function importProjectsTet(csvFilePath: string) {
  const baseUrl = "http://localhost:3000";
  const apiKey = process.env.TET_API_KEY;

  const apiClient = createClient<paths>({
    baseUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  fs.createReadStream(csvFilePath).pipe(parser);

  const projects: CreateProjetRequest[] = [];
  const invalidItemsFile = fs.createWriteStream("invalid_items.txt", { flags: "a" });

  for await (const record of parser as AsyncIterable<CsvRecord>) {
    const parsedLeviers = parseFieldToArray(record.leviers, leviers, "levier", invalidItemsFile);
    const parsedCompetences = parseFieldToArray(record.competences, competences, "competence", invalidItemsFile);

    // Validate and handle project status
    const validStatuses = projetStatusEnum.enumValues;
    const status = validStatuses.includes(record.project_status as ProjetStatus)
      ? (record.project_status as ProjetStatus)
      : null;

    projects.push({
      externalId: record.tet_id,
      nom: record.nom,
      description: record.description,
      dateDebutPrevisionnelle: new Date().toISOString(),
      budgetPrevisionnel: parseFloat(record.budget),
      status,
      collectivites: [{ code: record.insee_code, type: "Commune" }],
      leviers: parsedLeviers as Leviers,
      competences: parsedCompetences as Competences,
    });
  }

  // Close the write stream when done
  invalidItemsFile.end();

  const batchSize = 100;
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);

    printBatchWeight(batch);

    const { data, error } = await apiClient.POST("/projets/bulk", {
      body: { projects: batch },
    });

    console.error(`Successfully imported batch starting at index ${i}:`, data);
    if (error) {
      console.error(`Failed to import batch starting at index ${i}:`, error);
    } else {
      console.log(`Successfully imported ${data?.ids.length} projects from batch starting at index ${i}`);
    }
  }
}

function parseFieldToArray(
  field: string,
  validList: readonly string[],
  mode: "competence" | "levier",
  invalidItemsFile: fs.WriteStream,
): string[] {
  // Remove curly braces and quotes
  const cleanedField = field.replace(/[{}"]/g, "");

  // Split by comma followed by a capital letter or a digit
  return cleanedField
    .split(/,(?=[A-Z0-9])/)
    .map((item) => item.trim())
    .filter((item) => {
      if (item === "NULL" || item === "") {
        return false;
      }
      if (!validList.includes(item)) {
        invalidItemsFile.write(`Invalid ${mode}: ${item}\n`);
        return false;
      }
      return true;
    });
}

const printBatchWeight = (batch: CreateProjetRequest[]) => {
  const jsonString = JSON.stringify(batch);
  // Calculate the size in bytes
  const sizeInBytes = Buffer.byteLength(jsonString, "utf8");
  // Convert bytes to kilobytes for easier reading
  const sizeInKilobytes = sizeInBytes / 1024;
  console.log(`Batch size: ${sizeInBytes} bytes (${sizeInKilobytes.toFixed(2)} KB)`);
};

const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error("Please provide a CSV file path");
  process.exit(1);
}

void importProjectsTet(csvFilePath);
