import fs from "fs";
import { parse } from "csv-parse";
import { leviers } from "@/shared/const/leviers";
import { ProjetPhase, projetPhasesEnum } from "@database/schema";
import { CompetenceCode, CompetenceCodes, Leviers } from "@/shared/types";
import { CreateServiceRequest } from "@/services/dto/create-service.dto";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";
import { competencesFromM57Referentials } from "@/shared/const/competences-list";
import { makeNullIfEmptyString, parseExtraField, parseFieldToArray } from "../utils";

interface CsvRecord {
  name: string;
  description: string;
  sousTitre: string;
  logoUrl: string;
  redirectionUrl: string;
  redirectionLabel?: string;
  iframeUrl?: string;
  extendLabel?: string;
  isListed?: string;
}

interface CsvContextRecord {
  serviceName: string;
  description?: string;
  sousTitre?: string;
  logoUrl?: string;
  redirectionUrl?: string;
  redirectionLabel?: string;
  extendLabel?: string;
  iframeUrl?: string;
  competences: string;
  leviers: string;
  status: string;
  extraFields: string;
}

type ParsedServiceContext = CreateServiceContextRequest & { serviceName: string };

export interface ParsedData {
  data: { services: CreateServiceRequest[]; serviceContexts: ParsedServiceContext[] };
  errors: string[];
}

export async function parseServiceAndServiceContextsCSVFiles(
  servicesFilePath: string,
  contextsFilePath: string,
): Promise<ParsedData> {
  const parsingErrors: string[] = [];
  const services: CreateServiceRequest[] = [];
  const serviceContexts: ParsedServiceContext[] = [];

  // Parse services
  const servicesParser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const serviceCSVData = fs.createReadStream(servicesFilePath).pipe(servicesParser);

  for await (const serviceRecord of serviceCSVData as AsyncIterable<CsvRecord>) {
    services.push({
      ...serviceRecord,
      extendLabel: makeNullIfEmptyString(serviceRecord.extendLabel),
      redirectionLabel: makeNullIfEmptyString(serviceRecord.redirectionLabel),
      iframeUrl: makeNullIfEmptyString(serviceRecord.iframeUrl),
      isListed: serviceRecord.isListed === "FALSE" ? false : Boolean(serviceRecord.isListed),
    });
  }

  // Parse contexts
  const serviceContextsParser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const serviceContextsCSVData = fs.createReadStream(contextsFilePath).pipe(serviceContextsParser);

  for await (const serviceContextRecord of serviceContextsCSVData as AsyncIterable<CsvContextRecord>) {
    serviceContexts.push(parseServiceContextFromCsvRecord(serviceContextRecord, parsingErrors));
  }

  return { data: { services, serviceContexts }, errors: parsingErrors };
}

function parseServiceContextFromCsvRecord(record: CsvContextRecord, invalidItemsFile: string[]): ParsedServiceContext {
  const parsedLeviers = record.leviers ? parseFieldToArray(record.leviers, leviers, "levier", invalidItemsFile) : [];
  const competenceCodes = getCompetencesCodeFromLabels(record.competences);

  const parsedCompetences = competenceCodes
    ? parseFieldToArray(
        competenceCodes,
        Object.keys(competencesFromM57Referentials) as CompetenceCode[],
        "competence",
        invalidItemsFile,
      )
    : [];

  const parsedStatus = record.status
    ? parseFieldToArray(record.status, projetPhasesEnum.enumValues, "phases", invalidItemsFile)
    : [];

  return {
    serviceName: record.serviceName,
    leviers: parsedLeviers as Leviers,
    competences: parsedCompetences as CompetenceCodes,
    phases: parsedStatus as ProjetPhase[],
    description: makeNullIfEmptyString(record.description),
    sousTitre: makeNullIfEmptyString(record.sousTitre),
    logoUrl: makeNullIfEmptyString(record.logoUrl),
    redirectionUrl: makeNullIfEmptyString(record.redirectionUrl),
    redirectionLabel: makeNullIfEmptyString(record.redirectionLabel),
    extendLabel: makeNullIfEmptyString(record.extendLabel),
    iframeUrl: makeNullIfEmptyString(record.iframeUrl),
    extraFields: parseExtraField(record.extraFields),
    // todo add regions parsing logic
    regions: [],
  };
}

const competenceLabelToCode = Object.entries(competencesFromM57Referentials).reduce<Record<string, CompetenceCode>>(
  (acc, [code, label]) => {
    acc[label.trim()] = code as CompetenceCode;
    return acc;
  },
  {},
);

function getCompetencesCodeFromLabels(competences: string) {
  if (!competences) return "";

  const splitedCompetences = competences
    // Split on commas that are not inside quotes
    // - (?=...) is a positive lookahead that checks what follows the comma
    // - (?:[^"]*"[^"]*")* matches any number of pairs of quotes and their content
    // - [^"]*$ ensures we're not inside a quoted string by checking there's an even number of quotes until the end
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  const cleanedCompetences = splitedCompetences
    .map((label) => {
      // Remove any quotes and trim whitespace
      const trimedLabel = label.trim().replace(/^["']|["']$/g, "");
      const code = competenceLabelToCode[trimedLabel];
      if (!code) {
        console.log(`No code found for label: "${trimedLabel}"`);
      }
      return code ?? trimedLabel;
    })
    .join();

  return cleanedCompetences;
}
