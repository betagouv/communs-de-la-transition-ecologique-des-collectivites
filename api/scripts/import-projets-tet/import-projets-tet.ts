import { parse } from "csv-parse";
import * as fs from "fs";
import createClient from "openapi-fetch";
import type { paths } from "@test/generated-types";
import { config } from "dotenv";
import * as path from "path";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { leviers } from "@/shared/const/leviers";
import { competencesFromM57Referentials } from "@/shared/const/competences-list";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { PhaseStatut, phaseStatutEnum, ProjetPhase, projetPhasesEnum } from "@database/schema";

config({ path: path.resolve(__dirname, "../../.env") });

interface CsvRecord {
  tet_id: string;
  nom: string;
  description: string;
  budget: string;
  forecasted_start_date: string;
  commune: string;
  insee_code: string;
  siren_epci: string;
  nature_epci: string;
  leviers: string;
  codes_competences: string;
  phase: string;
  phasestatut: string;
}

const NATURE_EPCI_FISCALITE_PROPRE = ["CC", "CA", "METRO", "CU"];

async function importProjetsTet(csvFilePath: string) {
  const baseUrl = process.env.API_BASE_URL;
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
  const competencesCodeFromReferential = Object.keys(competencesFromM57Referentials);

  for await (const record of parser as AsyncIterable<CsvRecord>) {
    const parsedLeviers = parseFieldToArray(record.leviers, leviers, "levier", invalidItemsFile);
    const parsedCompetences = parseFieldToArray(
      record.codes_competences,
      competencesCodeFromReferential,
      "competence",
      invalidItemsFile,
    );

    // Validate and handle project status
    const validPhases = projetPhasesEnum.enumValues;
    const phase = validPhases.includes(record.phase as ProjetPhase) ? (record.phase as ProjetPhase) : null;

    const phaseStatut = phaseStatutEnum.enumValues.includes(record.phasestatut as PhaseStatut)
      ? (record.phasestatut as PhaseStatut)
      : null;

    if (NATURE_EPCI_FISCALITE_PROPRE.includes(record.nature_epci)) {
      projects.push({
        externalId: record.tet_id,
        nom: record.nom,
        description: record.description,
        budgetPrevisionnel: parseFloat(record.budget),
        phase,
        phaseStatut,
        collectivites: [mapCollectivites(record.insee_code, record.siren_epci)],
        leviers: parsedLeviers as Leviers,
        competences: parsedCompetences as CompetenceCodes,
      });
    }
  }

  // Close the write stream when done
  invalidItemsFile.end();

  const batchSize = 500;
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
  type: "competence" | "levier",
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
        invalidItemsFile.write(`Invalid ${type}: ${item}\n`);
        return false;
      }
      return true;
    });
}

const mapCollectivites = (inseeCode: string, epciCode: string): { code: string; type: "Commune" | "EPCI" } => {
  if (inseeCode) {
    return { code: inseeCode, type: "Commune" };
  }
  if (epciCode) {
    return { code: epciCode, type: "EPCI" };
  }
  throw new Error("At least one commune or EPCI needs to be provided");
};

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

void importProjetsTet(csvFilePath);
