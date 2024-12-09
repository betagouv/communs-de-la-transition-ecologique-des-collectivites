import { TestingModule } from "@nestjs/testing";
import { CollaboratorsService } from "./collaborators.service";
import { TestDatabaseService } from "@test/helpers/test-database.service";
import { projectCollaborators, projects } from "@database/schema";
import { teardownTestModule, testModule } from "@test/helpers/testModule";
import { and, eq } from "drizzle-orm";
import { CreateCollaboratorRequest } from "@/collaborators/dto/create-collaborator.dto";
import { NotFoundException } from "@nestjs/common";
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
      const collaboratorData: CreateCollaboratorRequest = {
        email: "view@example.com",
        permissionType: "VIEW",
      };

      await testDbService.database.transaction(async (tx) => {
        await collaboratorsService.createOrUpdate(
          tx,
          projectId,
          collaboratorData,
        );
      });

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
      const collaboratorData: CreateCollaboratorRequest = {
        email: "editor@example.com",
        permissionType: "EDIT",
      };

      await testDbService.database.transaction(async (tx) => {
        await collaboratorsService.createOrUpdate(
          tx,
          projectId,
          collaboratorData,
        );
      });

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

    it("should throw NotFoundException when project does not exist", async () => {
      const nonExistentProjectId = "00000000-0000-0000-0000-000000000000";
      const collaboratorData: CreateCollaboratorRequest = {
        email: "test@example.com",
        permissionType: "VIEW",
      };

      await testDbService.database.transaction(async (tx) => {
        await expect(
          collaboratorsService.createOrUpdate(
            tx,
            nonExistentProjectId,
            collaboratorData,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });

    it("should update permission and updatedAt when collaborator already exists", async () => {
      const collaboratorData: CreateCollaboratorRequest = {
        email: "test@example.com",
        permissionType: "VIEW",
      };

      let firstCollaborator;
      await testDbService.database.transaction(async (tx) => {
        firstCollaborator = await collaboratorsService.createOrUpdate(
          tx,
          projectId,
          collaboratorData,
        );
      });

      // Wait a bit to ensure timestamps are different
      await new Promise((resolve) => setTimeout(resolve, 200));

      await testDbService.database.transaction(async (tx) => {
        await collaboratorsService.createOrUpdate(tx, projectId, {
          ...collaboratorData,
          permissionType: "EDIT",
        });
      });

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
        permissionType: "EDIT",
        projectId,
      });

      expect(new Date(collaborators[0].updatedAt).getTime()).toBeGreaterThan(
        new Date(firstCollaborator.updatedAt).getTime(),
      );
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has exact permission", async () => {
      const collaboratorData: CreateCollaboratorRequest = {
        email: "viewer@example.com",
        permissionType: "VIEW",
      };

      await testDbService.database.transaction(async (tx) => {
        await collaboratorsService.createOrUpdate(
          tx,
          projectId,
          collaboratorData,
        );
      });

      const hasPermission = await collaboratorsService.hasPermission(
        projectId,
        collaboratorData.email,
        "VIEW",
      );

      expect(hasPermission).toBe(true);
    });

    it("should return true when checking VIEW permission for EDIT user", async () => {
      const collaboratorData: CreateCollaboratorRequest = {
        email: "editor@example.com",
        permissionType: "EDIT" as const,
      };

      await testDbService.database.transaction(async (tx) => {
        await collaboratorsService.createOrUpdate(
          tx,
          projectId,
          collaboratorData,
        );
      });
      const hasPermission = await collaboratorsService.hasPermission(
        projectId,
        collaboratorData.email,
        "VIEW",
      );

      expect(hasPermission).toBe(true);
    });

    it("should return false when user has insufficient permissions", async () => {
      const collaboratorData: CreateCollaboratorRequest = {
        email: "viewer@example.com",
        permissionType: "VIEW",
      };

      await testDbService.database.transaction(async (tx) => {
        await collaboratorsService.createOrUpdate(
          tx,
          projectId,
          collaboratorData,
        );
      });

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
