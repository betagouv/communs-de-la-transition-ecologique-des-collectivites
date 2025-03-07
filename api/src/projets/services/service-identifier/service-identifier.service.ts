import { Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class ServiceIdentifierService {
  getServiceIdFieldFromApiKey(apiKey: string): "mecId" | "tetId" | "recocoId" {
    switch (apiKey) {
      case process.env.MEC_API_KEY:
        return "mecId";
      case process.env.TET_API_KEY:
        return "tetId";
      case process.env.RECOCO_API_KEY:
        return "recocoId";
      default:
        throw new UnauthorizedException("Invalid API key");
    }
  }
}
