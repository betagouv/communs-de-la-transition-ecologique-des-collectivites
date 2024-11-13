import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsService } from "./projects.service";
import { projects } from "../database/schema";
import { DATABASE } from "../database/database.module";

describe("ProjectsService", () => {
  let service: ProjectsService;
  let db: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: DATABASE,
          useValue: {
            select: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    db = module.get(DATABASE);
  });

  describe("create", () => {
    it("should create a new project", async () => {
      const createDto = {
        name: "Test Project",
        description: "Test Description",
        ownerUserId: "user1",
      };

      const expectedProject = {
        id: "generated-id",
        createdAt: new Date(),
        ...createDto,
      };

      db.insert.mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([expectedProject]),
      });

      const result = await service.create(createDto);
      expect(result).toEqual(expectedProject);
      expect(db.insert).toHaveBeenCalledWith(projects);
    });
  });

  describe("findAll", () => {
    it("should return all projects", async () => {
      const expectedProjects = [
        {
          id: "1",
          name: "Project 1",
          description: "Description 1",
          ownerUserId: "user1",
          createdAt: new Date(),
        },
      ];

      db.select.mockReturnValue({
        from: jest.fn().mockResolvedValue(expectedProjects),
      });

      const result = await service.findAll();
      expect(result).toEqual(expectedProjects);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return a project by id", async () => {
      const expectedProject = {
        id: "1",
        name: "Project 1",
        description: "Description 1",
        ownerUserId: "user1",
        createdAt: new Date(),
      };

      db.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([expectedProject]),
      });

      const result = await service.findOne("1");
      expect(result).toEqual(expectedProject);
      expect(db.select).toHaveBeenCalled();
    });

    it("should return null when project not found", async () => {
      db.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findOne("999");
      expect(result).toBeNull();
    });
  });
});
