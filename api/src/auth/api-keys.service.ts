import { createHash } from "crypto";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { apiKeys } from "@database/schema";
import { DatabaseService } from "@/database/database.service";
import { ServiceType } from "@/shared/types";

export interface ActiveApiKey {
  serviceType: ServiceType;
  name: string;
}

/** Les clés ne sont jamais stockées en clair : seule l'empreinte SHA-256 est en base. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findActiveByHash(keyHash: string): Promise<ActiveApiKey | null> {
    const [row] = await this.databaseService.database
      .select({ serviceType: apiKeys.serviceType, name: apiKeys.name, id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
      .limit(1);

    if (!row) return null;

    // Audit léger, hors chemin critique — le cache du guard borne la fréquence.
    this.databaseService.database
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.id))
      .catch(() => undefined);

    return { serviceType: row.serviceType as ServiceType, name: row.name };
  }
}
