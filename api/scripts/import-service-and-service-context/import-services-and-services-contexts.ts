import createClient from "openapi-fetch";
import type { paths } from "@test/generated-types";
import { config } from "dotenv";
import { parseServiceAndServiceContextsCSVFiles, ParsedData } from "./parse-service-and-service-context";
import { currentEnv } from "@/shared/utils/currentEnv";

config({ path: `../../.env.${currentEnv}` });

if (!process.env.SERVICE_MANAGEMENT_API_KEY) {
  console.error("Please set SERVICE_MANAGEMENT_API_KEY environment variable");
  process.exit(1);
}

const baseUrl = process.env.API_BASE_URL;
const apiKey = process.env.SERVICE_MANAGEMENT_API_KEY;

const apiClient = createClient<paths>({
  baseUrl,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
});

async function importServicesAndServiceContexts(csvServiceFilePath: string, csvContextFilePath: string) {
  try {
    const { data, errors } = await parseServiceAndServiceContextsCSVFiles(csvServiceFilePath, csvContextFilePath);

    // we do not want to trigger the import if there are any invalid records
    if (errors.length > 0) {
      console.error("Invalid items found, exiting, please fix the data and try again", errors);
      process.exit(1);
    }

    await importParsedDataToDatabase(data);
  } catch (error) {
    console.error("Error during import:", error);
    process.exit(1);
  }
}

async function importParsedDataToDatabase(parsedData: ParsedData["data"]) {
  const serviceIdMap: Record<string, string> = {};

  // Import services
  for (const service of parsedData.services) {
    try {
      const { data, error } = await apiClient.POST("/services", { body: service });

      if (error) {
        console.error(`Failed to import service ${service.name}:`, error);
      } else {
        console.log(`Imported: ${data?.name} (${data?.id})`);
        serviceIdMap[service.name] = data?.id;
      }
    } catch (error) {
      console.error(`Error importing service ${service.name}:`, error);
    }
  }

  // Import service contexts
  for (const context of parsedData.serviceContexts) {
    const { serviceName, ...createContextRequest } = context;

    const serviceId = serviceIdMap[serviceName];
    if (!serviceId) {
      console.error(`Service ID not found for service name: ${serviceName}`);
      continue;
    }

    try {
      const { error } = await apiClient.POST("/services/contexts/{id}", {
        params: {
          path: { id: serviceId },
        },
        body: createContextRequest,
      });

      if (error) {
        console.error(`Failed to import service context for ${serviceName}:`, error);
      } else {
        console.log(`Imported service context for: ${serviceName}`);
      }
    } catch (error) {
      console.error(`Error importing service context for ${serviceName}:`, error);
    }
  }
}

// Run the import
void importServicesAndServiceContexts("./services-import-new.csv", "./services-context-import-new.csv");
