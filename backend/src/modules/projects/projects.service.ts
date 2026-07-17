import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, pageArgs } from '../../common/dto/pagination.dto';
import { dec, round4, safeDiv } from '../../common/utils/numbers';
import {
  AddMemberDto, CreateMilestoneDto, CreateProjectDto, QueryProjectsDto,
  UpdateMilestoneDto, UpdateProjectDto,
} from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, dto: QueryProjectsDto) {
    const where: Prisma.ProjectWhereInput = {
      companyId,
      ...(dto.status && { status: dto.status }),
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { code: { contains: dto.search, mode: 'insensitive' } },
          { location: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        ...pageArgs(dto),
        orderBy: { [dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc' },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { tasks: true, issues: true, risks: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);
    return paginate(data, total, dto);
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        consultant: true,
        milestones: { orderBy: { sortOrder: 'asc' } },
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        _count: {
          select: {
            tasks: true, risks: true, issues: true, variationOrders: true,
            invoices: true, purchaseOrders: true, dailyReports: true,
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  create(companyId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({ data: { ...dto, companyId } });
  }

  async update(companyId: string, id: string, dto: UpdateProjectDto) {
    await this.ensure(companyId, id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string) {
    await this.ensure(companyId, id);
    await this.prisma.project.update({ where: { id }, data: { status: 'CANCELLED' } });
    return { success: true };
  }

  /** Recompute cached overall progress from budget-weighted task progress. */
  async recomputeProgress(projectId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId, isSummary: false },
      select: { budget: true, progressPct: true },
    });
    const totalBudget = tasks.reduce((s, t) => s + dec(t.budget), 0);
    const progress =
      totalBudget > 0
        ? tasks.reduce((s, t) => s + dec(t.budget) * dec(t.progressPct), 0) / totalBudget
        : safeDiv(tasks.reduce((s, t) => s + dec(t.progressPct), 0), tasks.length);
    await this.prisma.project.update({
      where: { id: projectId },
      data: { progressPct: round4(progress) },
    });
    return round4(progress);
  }

  // ---- milestones ----
  listMilestones(projectId: string) {
    return this.prisma.milestone.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
  }
  createMilestone(projectId: string, dto: CreateMilestoneDto) {
    return this.prisma.milestone.create({ data: { ...dto, projectId } });
  }
  updateMilestone(id: string, dto: UpdateMilestoneDto) {
    return this.prisma.milestone.update({ where: { id }, data: dto });
  }
  async removeMilestone(id: string) {
    await this.prisma.milestone.delete({ where: { id } });
    return { success: true };
  }

  // ---- members ----
  addMember(projectId: string, dto: AddMemberDto) {
    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      create: { projectId, userId: dto.userId, role: dto.role },
      update: { role: dto.role },
    });
  }
  async removeMember(projectId: string, userId: string) {
    await this.prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    return { success: true };
  }

  private async ensure(companyId: string, id: string) {
    const found = await this.prisma.project.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!found) throw new NotFoundException('Project not found');
  }
}
