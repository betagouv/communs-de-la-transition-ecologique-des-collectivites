import fs from "fs";
import { parse } from "csv-parse";
import { makeNullIfEmptyString, parseExtraField, parseFieldToArray } from "./utils";
import { leviers } from "@/shared/const/leviers";
import { competences } from "@/shared/const/competences-list";
import { ProjectStatus } from "@database/schema";
import { Competences, Leviers } from "@/shared/types";
import { CreateServiceRequest } from "@/services/dto/create-service.dto";
import { CreateServiceContextRequest } from "@/services/dto/create-service-context.dto";

interface CsvRecord {
  name: string;
  description: string;
  sousTitre: string;
  logoUrl: string;
  redirectionUrl: string;
  redirectionLabel?: string;
  iframeUrl?: string;
  extendLabel?: string;
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
  services: CreateServiceRequest[];
  serviceContexts: ParsedServiceContext[];
}

export async function parseServiceAndServiceContextsCSVFiles(
  servicesFilePath: string,
  contextsFilePath: string,
  invalidRecords: string[],
): Promise<ParsedData> {
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
    services.push(serviceRecord);
  }

  // Parse contexts
  const serviceContextsParser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const serviceContextsCSVData = fs.createReadStream(contextsFilePath).pipe(serviceContextsParser);
  for await (const serviceContextRecord of serviceContextsCSVData as AsyncIterable<CsvContextRecord>) {
    serviceContexts.push(parseServiceContextFromCsvRecord(serviceContextRecord, invalidRecords));
  }

  // invalidItemsFile.end();
  return { services, serviceContexts };
}

function parseServiceContextFromCsvRecord(record: CsvContextRecord, invalidItemsFile: string[]): ParsedServiceContext {
  const status: ProjectStatus[] = ["IDEE", "FAISABILITE", "EN_COURS", "IMPACTE", "ABANDONNE", "TERMINE"] as const;

  const parsedLeviers = record.leviers ? parseFieldToArray(record.leviers, leviers, "levier", invalidItemsFile) : [];
  const parsedCompetences = record.competences
    ? parseFieldToArray(record.competences, competences, "competence", invalidItemsFile)
    : [];
  const parsedStatus = record.status ? parseFieldToArray(record.status, status, "status", invalidItemsFile) : [];

  return {
    serviceName: record.serviceName,
    leviers: parsedLeviers as Leviers,
    competences: parsedCompetences as Competences,
    status: parsedStatus as ProjectStatus[],
    description: record.description,
    sousTitre: record.sousTitre,
    logoUrl: makeNullIfEmptyString(record.logoUrl),
    redirectionUrl: makeNullIfEmptyString(record.redirectionUrl),
    redirectionLabel: makeNullIfEmptyString(record.redirectionLabel),
    extendLabel: makeNullIfEmptyString(record.extendLabel),
    iframeUrl: makeNullIfEmptyString(record.iframeUrl),
    extraFields: parseExtraField(record.extraFields),
  };
}
