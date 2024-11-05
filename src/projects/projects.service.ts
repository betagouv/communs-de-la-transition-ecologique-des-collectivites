import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma.service';
import { Prisma, Project } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}
  create(createProjectDto: CreateProjectDto) {
    console.log(createProjectDto);
    return 'This action adds a new project';
  }

  findAll() {
    return `This action returns all projects`;
  }

  findOne(id: Prisma.ProjectWhereUniqueInput): Promise<Project> {
    return this.prisma.project.findUnique({
      where: id,
    });
  }

  update(id: number, updateProjectDto: UpdateProjectDto) {
    console.log(updateProjectDto);
    return `This action updates a #${id} project`;
  }

  remove(id: number) {
    return `This action removes a #${id} project`;
  }
}
