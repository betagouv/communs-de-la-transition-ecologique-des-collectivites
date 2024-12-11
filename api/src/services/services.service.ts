import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateServiceDto } from "./dto/create-service.dto";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { services } from "@database/schema";

@Injectable()
export class ServicesService {
  private mockServices = [
    {
      id: "1",
      name: "Facili-Tacct",
      description:
        "Objectivez votre diagnostic avec les données socio-économiques qui rendent votre territoire unique et découvrez des arguments et ressources pour mobiliser vos collègues et partenaires externes sur l'adaptation au changement climatique.",
      logoUrl:
        "https://facili-tacct.beta.gouv.fr/_next/static/media/favicon.f453a8cf.svg",
      url: "https://facili-tacct.beta.gouv.fr/thematiques?codgeo=01010&codepci=200070852",
      createdAt: new Date(),
    },
    {
      id: "2",
      name: "La boussole de la transition écologique",
      description:
        "Accompagner le porteur de projet tout au long de sa réflexion, le plus en amont possible, pour améliorer son projet quelle qu’en soit sa nature, en prenant en compte les impacts environnementaux.",
      logoUrl:
        "https://www.boussole-te.ecologie.gouv.fr//IMG/svg/img_boussole.svg",
      url: "https://www.boussole-te.ecologie.gouv.fr/",
      createdAt: new Date(),
    },
  ];

  constructor(
    private dbService: DatabaseService,
    private logger: CustomLogger,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    this.logger.debug("Creating new service", { dto: createServiceDto });

    const [newService] = await this.dbService.database
      .insert(services)
      .values(createServiceDto)
      .returning();

    this.logger.log("Service created successfully", {
      serviceId: newService.id,
    });

    return newService;
  }

  async findAll() {
    return this.dbService.database.select().from(services);
  }

  async findOne(id: string) {
    const [service] = await this.dbService.database
      .select()
      .from(services)
      .where(eq(services.id, id));

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  getServicesByProjectId(projectId: string) {
    // For now, return mock data
    console.log("Returning mock services by projectid", projectId);
    return this.mockServices;
  }
}
