import fs from "fs";
import { parse } from "csv-parse";
import { makeNullIfEmptyString, parseExtraField, parseFieldToArray } from "./utils";
import { leviers } from "@/shared/const/leviers";
import { competences } from "@/shared/const/competences-list";
import { ProjetStatus, projetStatusEnum } from "@database/schema";
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
  isListed?: boolean;
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
      redirectionLabel: makeNullIfEmptyString(serviceRecord.redirectionLabel),
      iframeUrl: makeNullIfEmptyString(serviceRecord.iframeUrl),
      isListed: Boolean(serviceRecord.isListed),
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
  const parsedCompetences = record.competences
    ? parseFieldToArray(record.competences, competences, "competence", invalidItemsFile)
    : [];
  const parsedStatus = record.status
    ? parseFieldToArray(record.status, projetStatusEnum.enumValues, "status", invalidItemsFile)
    : [];

  return {
    serviceName: record.serviceName,
    leviers: parsedLeviers as Leviers,
    competences: parsedCompetences as Competences,
    status: parsedStatus as ProjetStatus[],
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
