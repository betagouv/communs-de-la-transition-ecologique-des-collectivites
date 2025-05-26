import { parse } from "csv-parse";
import * as fs from "fs";
import createClient from "openapi-fetch";
import type { paths } from "@test/generated-types";
import { config } from "dotenv";
import { CompetenceCodes, Leviers } from "@/shared/types";
import { leviers } from "@/shared/const/leviers";
import { competencesFromM57Referentials } from "@/shared/const/competences-list";
import { CreateProjetRequest } from "@projets/dto/create-projet.dto";
import { PhaseStatut, phaseStatutEnum, ProjetPhase, projetPhasesEnum } from "@database/schema";
import { join } from "path";
import { currentEnv } from "@/shared/utils/currentEnv";
import { parseFieldToArray } from "../utils";

config({ path: join(__dirname, `../../.env.${currentEnv}`) });

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

// todo we exclude METRO for now as we don't support departement/metropole as a collectivite
const NATURE_EPCI_FISCALITE_PROPRE = ["CC", "CA", "CU"];

const EPCI_TEST_CODES = "000000000";
const REUNION_DEPARTEMENT = "229740014";
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

async function importProjetsTet(csvFilePath: string) {
  const parsingErrors: string[] = [];

  fs.createReadStream(csvFilePath).pipe(parser);

  const projects: CreateProjetRequest[] = [];
  const competencesCodeFromReferential = Object.keys(competencesFromM57Referentials);
  // Ajout d'un compteur avant la boucle
  let ignoredRecords = 0;
  let ignoredByNatureEpci = 0;
  let ignoredBySirenEpci = 0;
  let totalRecords = 0;
  let eligibleProjects = 0;

  // Dans la boucle for await
  for await (const record of parser as AsyncIterable<CsvRecord>) {
    totalRecords++;

    if (!NATURE_EPCI_FISCALITE_PROPRE.includes(record.nature_epci)) {
      ignoredByNatureEpci++;
      ignoredRecords++;
      console.log(`Record ${record.tet_id} ignored due to nature_epci: ${record.nature_epci}`);
      continue;
    }

    if (record.siren_epci === EPCI_TEST_CODES || record.siren_epci === REUNION_DEPARTEMENT) {
      ignoredBySirenEpci++;
      ignoredRecords++;
      console.log(`Record ${record.tet_id} ignored due to siren_epci: ${record.siren_epci}`);
      continue;
    }
    const parsedLeviers = parseFieldToArray(record.leviers, leviers, "levier", parsingErrors);
    const parsedCompetences = parseFieldToArray(
      record.codes_competences,
      competencesCodeFromReferential,
      "competence",
      parsingErrors,
    );

    // Validate and handle project status
    const validPhases = projetPhasesEnum.enumValues;
    const phase = validPhases.includes(record.phase as ProjetPhase) ? (record.phase as ProjetPhase) : null;

    const phaseStatut = phaseStatutEnum.enumValues.includes(record.phasestatut as PhaseStatut)
      ? (record.phasestatut as PhaseStatut)
      : null;

    const isEligibleForImport =
      NATURE_EPCI_FISCALITE_PROPRE.includes(record.nature_epci) &&
      record.siren_epci !== EPCI_TEST_CODES &&
      // we do this as reunion is the only departement that is entered as a CC the other are entered as a METRO.
      // we will import those fiche action once we get the proper support for departement
      record.siren_epci !== REUNION_DEPARTEMENT;

    if (isEligibleForImport) {
      eligibleProjects++;

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

  console.log(`Parsed ${totalRecords} records, ${eligibleProjects} eligible projects`);
  // we do not want to trigger the import if there are any invalid records
  if (parsingErrors.length > 0) {
    console.error("Invalid items found, exiting, please fix the data and try again", parsingErrors);
    process.exit(1);
  }

  const batchSize = 300;
  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);

    printBatchWeight(batch);

    const { data, error } = await apiClient.POST("/projets/bulk", {
      body: { projets: batch },
    });

    console.log(`Successfully imported batch starting at index ${i}:`, data);
    if (error) {
      console.error(`Failed to import batch starting at index ${i}:`, error);
    } else {
      console.log(`Successfully imported ${data?.ids.length} projects from batch starting at index ${i}`);
    }
  }
  console.log(`Total records processed: ${totalRecords}`);
  console.log(`Total records imported: ${eligibleProjects}`);
  console.log(`Total records ignored: ${ignoredRecords}`);
  console.log(`Records ignored by nature_epci: ${ignoredByNatureEpci}`);
  console.log(`Records ignored by siren_epci: ${ignoredBySirenEpci}`);
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
