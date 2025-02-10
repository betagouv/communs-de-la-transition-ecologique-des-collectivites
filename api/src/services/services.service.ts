import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateServiceRequest, CreateServiceResponse } from "./dto/create-service.dto";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "@logging/logger.service";
import { services } from "@database/schema";
import { fakeServiceData } from "@/services/fake-service-data";

@Injectable()
export class ServicesService {
  constructor(
    private dbService: DatabaseService,
    private logger: CustomLogger,
  ) {}

  async create(createServiceDto: CreateServiceRequest): Promise<CreateServiceResponse> {
    this.logger.debug("Creating new service", { dto: createServiceDto });

    const [newService] = await this.dbService.database.insert(services).values(createServiceDto).returning();

    this.logger.log("Service created successfully", {
      serviceId: newService.id,
    });

    return newService;
  }

  async findAll() {
    return this.dbService.database.select().from(services);
  }

  async findOne(id: string) {
    const [service] = await this.dbService.database.select().from(services).where(eq(services.id, id));

    if (!service) {
      throw new NotFoundException(`Service with ID ${id} not found`);
    }

    return service;
  }

  getServicesByProjectId(projectId: string) {
    // For now, return mock data
    console.log("Returning mock services by projectid", projectId);
    return fakeServiceData;
  }
}
