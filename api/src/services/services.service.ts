import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateServiceDto } from "./dto/create-service.dto";
import { services } from "@database/schema";
import { eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { CustomLogger } from "../../logging/logger.service";

@Injectable()
export class ServicesService {
  private mockServices = [
    {
      id: "1",
      name: "GitHub",
      description: "Version control and collaboration platform",
      logoUrl: "https://github.com/logo.png",
      url: "https://github.com",
      createdAt: new Date(),
    },
    {
      id: "2",
      name: "Jira",
      description: "Project management tool",
      logoUrl: "https://jira.com/logo.png",
      url: "https://jira.com",
      createdAt: new Date(),
    },
  ];

  constructor(
    private dbService: DatabaseService,
    private logger: CustomLogger,
  ) {}

  async create(createServiceDto: CreateServiceDto) {
    this.logger.debug("Creating new service", { dto: createServiceDto });

    try {
      const [newService] = await this.dbService.database
        .insert(services)
        .values(createServiceDto)
        .returning();

      this.logger.log("Service created successfully", {
        serviceId: newService.id,
      });

      return newService;
    } catch (error) {
      this.logger.error("Failed to create service", {
        error: error.message,
        dto: createServiceDto,
      });
      throw error;
    }
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

  async getServicesByProjectId(projectId: string) {
    // For now, return mock data
    console.log("Returning mock services by projectid", projectId);
    return this.mockServices;
  }
}
