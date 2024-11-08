import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, PrismaService],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('findOne', () => {
    it('should return a project when it exists', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        description: 'Test Description',
        ownerUserId: 'user1',
        createdAt: new Date(),
      };

      jest
        .spyOn(prismaService.project, 'findUnique')
        .mockResolvedValue(mockProject);

      const result = await service.findOne({ id: '1' });
      expect(result).toEqual(mockProject);
    });

    it('should return null when project does not exist', async () => {
      jest.spyOn(prismaService.project, 'findUnique').mockResolvedValue(null);

      const result = await service.findOne({ id: 'nonexistent' });
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should successfully create a project', async () => {
      const createDto = {
        name: 'New Project',
        description: 'Project Description',
        ownerUserId: 'user1',
      };

      const expectedProject = {
        id: 'generated-id',
        createdAt: new Date(),
        ...createDto,
      };

      jest
        .spyOn(prismaService.project, 'create')
        .mockResolvedValue(expectedProject);

      const result = await service.create(createDto);

      expect(result).toEqual(expectedProject);
      expect(prismaService.project.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });

    it('should throw an error if project creation fails', async () => {
      const createDto = {
        name: 'New Project',
        description: 'Project Description',
        ownerUserId: 'user1',
      };

      jest
        .spyOn(prismaService.project, 'create')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDto)).rejects.toThrow('Database error');
    });
  });
});
