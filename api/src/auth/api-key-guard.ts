import { ServiceType } from "@/shared/types";
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ApiKeysService, hashApiKey } from "./api-keys.service";

// Add service type to Request interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      serviceType?: ServiceType;
    }
  }
}

/** TTL du cache des clés résolues en base — borne aussi la fréquence du last_used_at. */
const DB_KEY_CACHE_TTL_MS = 60_000;

/**
 * Deux sources de vérité pendant la transition :
 * 1. les clés historiques en variables d'env (une par service) — inchangées ;
 * 2. la table api_keys (plusieurs clés par service, hashées, révocables sans redeploy).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly envApiKeys: Record<string, ServiceType>;
  private readonly dbKeyCache = new Map<string, { serviceType: ServiceType; expiresAt: number }>();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly apiKeysService: ApiKeysService,
  ) {
    this.envApiKeys = {
      [this.configService.get<string>("MEC_API_KEY")!]: "MEC",
      [this.configService.get<string>("TET_API_KEY")!]: "TeT",
      [this.configService.get<string>("RECOCO_API_KEY")!]: "Recoco",
      [this.configService.get<string>("URBAN_VITALIZ_API_KEY")!]: "UrbanVitaliz",
      [this.configService.get<string>("SOS_PONTS_API_KEY")!]: "SosPonts",
      [this.configService.get<string>("FOND_VERT_API_KEY")!]: "FondVert",
      [this.configService.get<string>("DASHBOARD_TE_API_KEY")!]: "DashboardTE",
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>("isPublic", context.getHandler());

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Invalid authorization header format");
    }

    const apiKey = authHeader.split(" ")[1];

    const serviceType = this.envApiKeys[apiKey] ?? (await this.resolveDbKey(apiKey));

    if (!serviceType) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Add the service type to the request object for future use
    request.serviceType = serviceType;

    return true;
  }

  private async resolveDbKey(apiKey: string): Promise<ServiceType | null> {
    const keyHash = hashApiKey(apiKey);

    const cached = this.dbKeyCache.get(keyHash);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.serviceType;
    }

    const found = await this.apiKeysService.findActiveByHash(keyHash);
    if (!found) {
      this.dbKeyCache.delete(keyHash);
      return null;
    }

    this.dbKeyCache.set(keyHash, { serviceType: found.serviceType, expiresAt: Date.now() + DB_KEY_CACHE_TTL_MS });
    return found.serviceType;
  }
}
