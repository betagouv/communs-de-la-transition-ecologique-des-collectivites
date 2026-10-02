import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { ApiKeyGuard } from "./api-key-guard";
import { ApiKeysService, hashApiKey } from "./api-keys.service";

describe("ApiKeyGuard", () => {
  const ENV_KEYS: Record<string, string> = {
    MEC_API_KEY: "env-mec-key",
    TET_API_KEY: "env-tet-key",
    RECOCO_API_KEY: "env-recoco-key",
    URBAN_VITALIZ_API_KEY: "env-uv-key",
    SOS_PONTS_API_KEY: "env-sp-key",
    FOND_VERT_API_KEY: "env-fv-key",
    DASHBOARD_TE_API_KEY: "env-dte-key",
  };

  let apiKeysService: jest.Mocked<Pick<ApiKeysService, "findActiveByHash">>;
  let guard: ApiKeyGuard;
  let request: { headers: Record<string, string>; serviceType?: string };

  const contextFor = (authorization?: string): ExecutionContext => {
    request = { headers: authorization ? { authorization } : {} };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    const configService = {
      get: jest.fn((name: string) => ENV_KEYS[name]),
    } as unknown as ConfigService;
    const reflector = { get: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    apiKeysService = { findActiveByHash: jest.fn().mockResolvedValue(null) };
    guard = new ApiKeyGuard(configService, reflector, apiKeysService as unknown as ApiKeysService);
  });

  it("accepts a legacy env key and sets the service type (transition path)", async () => {
    await expect(guard.canActivate(contextFor("Bearer env-tet-key"))).resolves.toBe(true);
    expect(request.serviceType).toBe("TeT");
    expect(apiKeysService.findActiveByHash).not.toHaveBeenCalled();
  });

  it("accepts a database key and sets the service type", async () => {
    apiKeysService.findActiveByHash.mockResolvedValue({ serviceType: "TeT", name: "TeT — Mehdi" });

    await expect(guard.canActivate(contextFor("Bearer ck_prod_abc123"))).resolves.toBe(true);
    expect(request.serviceType).toBe("TeT");
    expect(apiKeysService.findActiveByHash).toHaveBeenCalledWith(hashApiKey("ck_prod_abc123"));
  });

  it("caches database lookups (one query per key within the TTL)", async () => {
    apiKeysService.findActiveByHash.mockResolvedValue({ serviceType: "MEC", name: "MEC — test" });

    await guard.canActivate(contextFor("Bearer ck_prod_cached"));
    await guard.canActivate(contextFor("Bearer ck_prod_cached"));

    expect(apiKeysService.findActiveByHash).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown key", async () => {
    await expect(guard.canActivate(contextFor("Bearer nope"))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a revoked (inactive) database key", async () => {
    apiKeysService.findActiveByHash.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor("Bearer ck_prod_revoked"))).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a malformed authorization header", async () => {
    await expect(guard.canActivate(contextFor("Basic foo"))).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(contextFor(undefined))).rejects.toThrow(UnauthorizedException);
  });

  it("lets public routes through without any key", async () => {
    const reflector = { get: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const configService = { get: jest.fn((n: string) => ENV_KEYS[n]) } as unknown as ConfigService;
    const publicGuard = new ApiKeyGuard(configService, reflector, apiKeysService as unknown as ApiKeysService);

    await expect(publicGuard.canActivate(contextFor(undefined))).resolves.toBe(true);
  });
});

describe("hashApiKey", () => {
  it("is a hex sha-256, stable and key-sensitive", () => {
    expect(hashApiKey("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey("abc")).toBe(hashApiKey("abc"));
    expect(hashApiKey("abc")).not.toBe(hashApiKey("abd"));
  });
});
