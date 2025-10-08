import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ServiceTypeIds } from "@/shared/types";

@Injectable()
export class ServiceIdentifierService {
  private readonly apiKeyMap: Map<string, ServiceTypeIds>;

  constructor(private configService: ConfigService) {
    this.apiKeyMap = new Map([
      [this.configService.get<string>("MEC_API_KEY")!, "mecId"],
      [this.configService.get<string>("TET_API_KEY")!, "tetId"],
      [this.configService.get<string>("RECOCO_API_KEY")!, "recocoId"],
      [this.configService.get<string>("URBAN_VITALIZ_API_KEY")!, "urbanVitalizId"],
      [this.configService.get<string>("SOS_PONTS_API_KEY")!, "sosPontsId"],
      [this.configService.get<string>("FOND_VERT_API_KEY")!, "fondVertId"],
    ]);
  }

  getServiceIdFieldFromApiKey(apiKey: string): ServiceTypeIds {
    const serviceId = this.apiKeyMap.get(apiKey);

    if (!serviceId) {
      throw new UnauthorizedException("Invalid API key");
    }

    return serviceId;
  }
}
