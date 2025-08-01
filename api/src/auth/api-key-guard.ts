import { ServiceType } from "@/shared/types";
import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

// Add service type to Request interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      serviceType?: ServiceType;
    }
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKeys: Record<string, ServiceType>;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.apiKeys = {
      [this.configService.get<string>("MEC_API_KEY")!]: "MEC",
      [this.configService.get<string>("TET_API_KEY")!]: "TeT",
      [this.configService.get<string>("RECOCO_API_KEY")!]: "Recoco",
      [this.configService.get<string>("URBAN_VITALIZ_API_KEY")!]: "UrbanVitaliz",
      [this.configService.get<string>("SOS_PONTS_API_KEY")!]: "SosPonts",
      [this.configService.get<string>("FOND_VERT_API_KEY")!]: "FondVert",
    };
  }

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
    const serviceType = this.apiKeys[apiKey];

    if (!serviceType) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Add the service type to the request object for future use
    request.serviceType = serviceType;

    return true;
  }
}
