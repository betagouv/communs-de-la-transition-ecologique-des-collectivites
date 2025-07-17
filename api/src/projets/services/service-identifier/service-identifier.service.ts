import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ServiceTypeIds } from "@/shared/types";

@Injectable()
export class ServiceIdentifierService {
  getServiceIdFieldFromApiKey(apiKey: string): ServiceTypeIds {
    switch (apiKey) {
      case process.env.MEC_API_KEY:
        return "mecId";
      case process.env.TET_API_KEY:
        return "tetId";
      case process.env.RECOCO_API_KEY:
        return "recocoId";
      case process.env.URBAN_VITALIZ_API_KEY:
        return "urbanVitalizId";
      case process.env.SOS_PONTS_API_KEY:
        return "sosPontsId";
      case process.env.FOND_VERT_API_KEY:
        return "fondVertId";
      default:
        throw new UnauthorizedException("Invalid API key");
    }
  }
}
