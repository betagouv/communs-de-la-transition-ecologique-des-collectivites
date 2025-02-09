import { parse } from "csv-parse";
import * as fs from "fs";
import createClient from "openapi-fetch";
import type { paths } from "@test/generated-types";
import { config } from "dotenv";
import * as path from "path";
import { CreateProjectRequest } from "@projects/dto/create-project.dto";
import { ProjectStatus, projectStatusEnum } from "@database/schema";

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
  const baseUrl = "https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/";
  const apiKey = process.env.MEC_API_KEY;

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

  const projects: CreateProjectRequest[] = [];
  for await (const record of parser as AsyncIterable<CsvRecord>) {
    /*    const parsedLeviers = parseFieldToArray(record.leviers, leviers);
    const parsedCompetences = parseFieldToArray(record.competences, competences);

    console.log("transformed levier", parsedLeviers);
    console.log("transformed comp", parsedCompetences);*/

    // Validate and handle project status
    const validStatuses = projectStatusEnum.enumValues;
    const status = validStatuses.includes(record.project_status as ProjectStatus)
      ? (record.project_status as ProjectStatus)
      : null; // Handle invalid status as needed

    projects.push({
      externalId: record.tet_id,
      nom: record.nom,
      description: record.description,
      forecastedStartDate: new Date().toISOString(),
      budget: parseFloat(record.budget),
      status,
      communeInseeCodes: [record.insee_code],
      //leviers: parsedLeviers as Leviers,
      //competences: parsedCompetences as Competences,
    });
  }

  const batchSize = 100;
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);
    const { data, error } = await apiClient.POST("/projects/bulk", {
      body: { projects: batch },
    });

    console.error(`Successfully imported batch starting at index ${i}:`, data);
    if (error) {
      console.error(`Failed to import batch starting at index ${i}:`, error);
    } else {
      console.log(`Successfully imported ${data?.ids.length} projects from batch starting at index ${i}`);
    }
    //console.error(`Error during project import for batch starting at index ${i}:`, error);
  }
}

/*function parseFieldToArray(field: string, validList: readonly string[]): string[] {
  // Remove curly braces and quotes
  const cleanedField = field.replace(/[{}"]/g, "");

  // Split by comma followed by a space and a capital letter
  return cleanedField
    .split(/,(?=[A-Z])/)
    .map((item) => item.trim())
    .filter((item) => {
      if (item === "NULL" || item === "") {
        return false;
      }
      if (!validList.includes(item)) {
        throw new Error(`Invalid item: ${item}`);
      }
      return true;
    });
}*/

// Check if CSV file path is provided
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.error("Please provide a CSV file path");
  process.exit(1);
}

// Run the import
void importProjectsTet(csvFilePath);
