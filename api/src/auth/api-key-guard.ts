import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { Request } from "express";

@Injectable()
class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
    const validApiKey = this.configService.get<string>("API_KEY");

    if (!validApiKey) {
      throw new UnauthorizedException("API key is not configured");
    }

    if (apiKey !== validApiKey) {
      throw new UnauthorizedException("Invalid API key");
    }

    return true;
  }
}

export const ApiKeyGuardProvider = {
  provide: APP_GUARD,
  useClass: ApiKeyGuard,
};
