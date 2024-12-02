import { TestingModule } from "@nestjs/testing";
import { CollaboratorsService } from "./collaborators.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { projectCollaborators, projects } from "@database/schema";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { and, eq } from "drizzle-orm";
import { CreateCollaboratorDto } from "@/collaborators/dto/add-collaborator.dto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { getFutureDate } from "@test/helpers/getFutureDate";

describe("CollaboratorsService", () => {
  let collaboratorsService: CollaboratorsService;
  let testDbService: TestDatabaseService;
  let module: TestingModule;
  let projectId: string;

  beforeAll(async () => {
    const { module: internalModule, testDbService: tds } = await testModule();
    module = internalModule;
    testDbService = tds;
    collaboratorsService =
      module.get<CollaboratorsService>(CollaboratorsService);
  });

  afterAll(async () => {
    await teardownTestModule(testDbService, module);
  });

  beforeEach(async () => {
    await testDbService.cleanDatabase();

    const [project] = await testDbService.database
      .insert(projects)
      .values({
        nom: "Test Project",
        description: "Test Description",
        budget: 100000,
        forecastedStartDate: getFutureDate(),
        status: "DRAFT",
      })
      .returning();

    projectId = project.id;
  });

  describe("create collaborator", () => {
    it("should add a new collaborator with VIEW permission", async () => {
      const collaboratorData: CreateCollaboratorDto = {
        email: "view@example.com",
        permissionType: "VIEW",
      };

      await collaboratorsService.create(projectId, collaboratorData);

      const collaborators = await testDbService.database
        .select()
        .from(projectCollaborators)
        .where(
          and(
            eq(projectCollaborators.projectId, projectId),
            eq(projectCollaborators.email, collaboratorData.email),
          ),
        );

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0]).toMatchObject({
        email: collaboratorData.email,
        permissionType: collaboratorData.permissionType,
        projectId,
      });
    });

    it("should add a new collaborator with EDIT permission", async () => {
      const collaboratorData: CreateCollaboratorDto = {
        email: "editor@example.com",
        permissionType: "EDIT",
      };

      await collaboratorsService.create(projectId, collaboratorData);

      const collaborators = await testDbService.database
        .select()
        .from(projectCollaborators)
        .where(eq(projectCollaborators.projectId, projectId));

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0]).toMatchObject({
        email: collaboratorData.email,
        permissionType: collaboratorData.permissionType,
        projectId,
      });
    });

    it("should throw ConflictException when adding an existing collaborator", async () => {
      const collaboratorData: CreateCollaboratorDto = {
        email: "existing@example.com",
        permissionType: "VIEW",
      };

      await collaboratorsService.create(projectId, collaboratorData);

      await expect(
        collaboratorsService.create(projectId, collaboratorData),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw NotFoundException when project does not exist", async () => {
      const nonExistentProjectId = "00000000-0000-0000-0000-000000000000";
      const collaboratorData: CreateCollaboratorDto = {
        email: "test@example.com",
        permissionType: "VIEW",
      };

      await expect(
        collaboratorsService.create(nonExistentProjectId, collaboratorData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has exact permission", async () => {
      const collaboratorData: CreateCollaboratorDto = {
        email: "viewer@example.com",
        permissionType: "VIEW",
      };

      await collaboratorsService.create(projectId, collaboratorData);

      const hasPermission = await collaboratorsService.hasPermission(
        projectId,
        collaboratorData.email,
        "VIEW",
      );

      expect(hasPermission).toBe(true);
    });

    it("should return true when checking VIEW permission for EDIT user", async () => {
      const collaboratorData: CreateCollaboratorDto = {
        email: "editor@example.com",
        permissionType: "EDIT" as const,
      };

      await collaboratorsService.create(projectId, collaboratorData);

      const hasPermission = await collaboratorsService.hasPermission(
        projectId,
        collaboratorData.email,
        "VIEW",
      );

      expect(hasPermission).toBe(true);
    });

    it("should return false when user has insufficient permissions", async () => {
      const collaboratorData: CreateCollaboratorDto = {
        email: "viewer@example.com",
        permissionType: "VIEW",
      };

      await collaboratorsService.create(projectId, collaboratorData);

      const hasPermission = await collaboratorsService.hasPermission(
        projectId,
        collaboratorData.email,
        "EDIT",
      );

      expect(hasPermission).toBe(false);
    });

    it("should return false when user has no permissions", async () => {
      const hasPermission = await collaboratorsService.hasPermission(
        projectId,
        "nonexistent@example.com",
        "VIEW",
      );

      expect(hasPermission).toBe(false);
    });
  });
});
