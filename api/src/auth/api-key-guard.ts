import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers["x-api-key"] ?? request.query.api_key;

    if (!apiKey) {
      throw new UnauthorizedException("API key is missing");
    }

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
