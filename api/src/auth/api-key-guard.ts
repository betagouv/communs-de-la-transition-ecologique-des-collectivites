import { ServiceType } from "@/shared/types";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
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

/** Méthodes autorisées à une clé en lecture seule. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface ResolvedKey {
  serviceType: ServiceType;
  readOnly: boolean;
}

/**
 * Deux sources de vérité pendant la transition :
 * 1. les clés historiques en variables d'env (une par service) — inchangées ;
 * 2. la table api_keys (plusieurs clés par service, hashées, révocables sans redeploy).
 *
 * Une clé en base peut être en lecture seule : elle n'ouvre que les méthodes sûres
 * (403 sinon). Les clés d'env restent en lecture/écriture.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly envApiKeys: Record<string, ServiceType>;
  private readonly dbKeyCache = new Map<string, ResolvedKey & { expiresAt: number }>();

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

    const envServiceType = this.envApiKeys[apiKey];
    const resolved: ResolvedKey | null = envServiceType
      ? { serviceType: envServiceType, readOnly: false }
      : await this.resolveDbKey(apiKey);

    if (!resolved) {
      throw new UnauthorizedException("Invalid API key");
    }

    if (resolved.readOnly && !SAFE_METHODS.has(request.method)) {
      throw new ForbiddenException("This API key is read-only");
    }

    // Add the service type to the request object for future use
    request.serviceType = resolved.serviceType;

    return true;
  }

  private async resolveDbKey(apiKey: string): Promise<ResolvedKey | null> {
    const keyHash = hashApiKey(apiKey);

    const cached = this.dbKeyCache.get(keyHash);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const found = await this.apiKeysService.findActiveByHash(keyHash);
    if (!found) {
      this.dbKeyCache.delete(keyHash);
      return null;
    }

    const resolved = { serviceType: found.serviceType, readOnly: found.readOnly };
    this.dbKeyCache.set(keyHash, { ...resolved, expiresAt: Date.now() + DB_KEY_CACHE_TTL_MS });
    return resolved;
  }
}
