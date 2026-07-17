import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round4 } from '../../common/utils/numbers';
import { computeCpm, CpmCycleError, CpmDependency, CpmTaskInput } from './cpm.engine';
import {
  CreateDependencyDto, CreateTaskDto, CreateWbsNodeDto, ProgressUpdateDto,
  UpdateTaskDto, UpdateWbsNodeDto,
} from './scheduling.dto';

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // WBS
  // =========================================================================
  listWbs(projectId: string) {
    return this.prisma.wbsNode.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tasks: true, children: true } } },
    });
  }

  createWbs(projectId: string, dto: CreateWbsNodeDto) {
    return this.prisma.wbsNode.create({ data: { ...dto, projectId } });
  }

  updateWbs(id: string, dto: UpdateWbsNodeDto) {
    return this.prisma.wbsNode.update({ where: { id }, data: dto });
  }

  async removeWbs(id: string) {
    await this.prisma.wbsNode.delete({ where: { id } });
    return { success: true };
  }

  // =========================================================================
  // Tasks
  // =========================================================================
  async listTasks(projectId: string, filters: { status?: TaskStatus; critical?: boolean } = {}) {
    return this.prisma.task.findMany({
      where: {
        projectId,
        ...(filters.status && { status: filters.status }),
        ...(filters.critical !== undefined && { isCritical: filters.critical }),
      },
      orderBy: { code: 'asc' },
      include: {
        wbsNode: { select: { id: true, code: true, name: true } },
        responsible: { select: { id: true, firstName: true, lastName: true } },
        predecessors: { include: { predecessor: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async createTask(projectId: string, dto: CreateTaskDto) {
    const { dependencies, ...data } = dto;
    const maxCode = await this.prisma.task.aggregate({
      where: { projectId },
      _max: { code: true },
    });
    const task = await this.prisma.task.create({
      data: {
        ...data,
        projectId,
        code: (maxCode._max.code ?? 0) + 1,
        durationDays:
          data.durationDays ??
          Math.max(0, differenceInCalendarDays(data.plannedFinish, data.plannedStart)),
      },
    });
    if (dependencies?.length) {
      for (const dep of dependencies) {
        await this.addDependency(projectId, { ...dep, successorId: task.id });
      }
    }
    return task;
  }

  async updateTask(id: string, dto: UpdateTaskDto) {
    const { dependencies: _ignored, ...data } = dto;
    const task = await this.prisma.task.update({ where: { id }, data });
    // status auto-derivation from progress
    if (dto.progressPct !== undefined) {
      await this.applyProgressStatus(task.id, Number(dto.progressPct));
    }
    return this.prisma.task.findUnique({ where: { id } });
  }

  async removeTask(id: string) {
    await this.prisma.task.delete({ where: { id } });
    return { success: true };
  }

  async logProgress(taskId: string, dto: ProgressUpdateDto, userId?: string) {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    await this.prisma.taskProgressLog.create({
      data: {
        taskId,
        date: dto.date ?? new Date(),
        progressPct: dto.progressPct,
        note: dto.note,
        createdById: userId,
      },
    });
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        progressPct: dto.progressPct,
        ...(dto.progressPct > 0 && !task.actualStart ? { actualStart: dto.date ?? new Date() } : {}),
        ...(dto.progressPct >= 1 ? { actualFinish: dto.date ?? new Date() } : {}),
      },
    });
    await this.applyProgressStatus(taskId, Number(dto.progressPct));
    return this.prisma.task.findUnique({ where: { id: taskId } });
  }

  private async applyProgressStatus(taskId: string, progress: number) {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    let status: TaskStatus = task.status;
    if (progress >= 1) status = 'COMPLETED';
    else if (progress > 0) {
      // delayed when planned finish passed and not complete
      status = task.plannedFinish < new Date() ? 'DELAYED' : 'IN_PROGRESS';
    } else if (task.status === 'COMPLETED') status = 'IN_PROGRESS';
    if (status !== task.status) {
      await this.prisma.task.update({ where: { id: taskId }, data: { status } });
    }
  }

  // =========================================================================
  // Dependencies
  // =========================================================================
  async addDependency(
    projectId: string,
    dto: CreateDependencyDto & { successorId: string },
  ) {
    if (dto.predecessorId === dto.successorId) {
      throw new BadRequestException('A task cannot depend on itself');
    }
    const [pred, succ] = await Promise.all([
      this.prisma.task.findFirst({ where: { id: dto.predecessorId, projectId } }),
      this.prisma.task.findFirst({ where: { id: dto.successorId, projectId } }),
    ]);
    if (!pred || !succ) throw new NotFoundException('Task not found in project');

    const dep = await this.prisma.taskDependency.create({
      data: {
        predecessorId: dto.predecessorId,
        successorId: dto.successorId,
        type: dto.type ?? 'FS',
        lagDays: dto.lagDays ?? 0,
      },
    });
    // validate no cycle; roll back if cyclic
    try {
      await this.runCpm(projectId, false);
    } catch (e) {
      await this.prisma.taskDependency.delete({ where: { id: dep.id } });
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Dependency would create a cycle');
    }
    return dep;
  }

  async removeDependency(id: string) {
    await this.prisma.taskDependency.delete({ where: { id } });
    return { success: true };
  }

  // =========================================================================
  // CPM — forward/backward pass, float, critical path
  // =========================================================================
  async runCpm(projectId: string, persist = true) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      select: {
        id: true, durationDays: true, plannedStart: true, constraintType: true, constraintDate: true,
      },
    });
    const deps = await this.prisma.taskDependency.findMany({
      where: { predecessor: { projectId }, successor: { projectId } },
    });

    const projectStart = project.startDate;
    const cpmTasks: CpmTaskInput[] = tasks.map((t) => ({
      id: t.id,
      duration: t.durationDays,
      notEarlierThan:
        t.constraintType === 'START_NO_EARLIER_THAN' || t.constraintType === 'MUST_START_ON'
          ? Math.max(0, differenceInCalendarDays(t.constraintDate ?? t.plannedStart, projectStart))
          : undefined,
    }));
    const cpmDeps: CpmDependency[] = deps.map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
      type: d.type,
      lag: d.lagDays,
    }));

    let result;
    try {
      result = computeCpm(cpmTasks, cpmDeps);
    } catch (e) {
      if (e instanceof CpmCycleError) {
        throw new BadRequestException(`Schedule network contains a cycle involving tasks: ${e.cycle.length}`);
      }
      throw e;
    }

    if (persist) {
      const updates = [...result.tasks.values()].map((r) =>
        this.prisma.task.update({
          where: { id: r.id },
          data: {
            earlyStart: addDays(projectStart, r.earlyStart),
            earlyFinish: addDays(projectStart, r.earlyFinish),
            lateStart: addDays(projectStart, r.lateStart),
            lateFinish: addDays(projectStart, r.lateFinish),
            totalFloat: r.totalFloat,
            freeFloat: r.freeFloat,
            isCritical: r.isCritical,
          },
        }),
      );
      await this.prisma.$transaction(updates);
    }

    return {
      projectDurationDays: result.projectDuration,
      forecastFinish: addDays(projectStart, result.projectDuration),
      criticalTaskCount: result.criticalPath.length,
      criticalPath: result.criticalPath,
      computedAt: new Date(),
    };
  }

  // =========================================================================
  // Gantt data
  // =========================================================================
  async ganttData(projectId: string) {
    const [project, tasks, deps, baseline] = await Promise.all([
      this.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { id: true, name: true, startDate: true, finishDate: true },
      }),
      this.prisma.task.findMany({
        where: { projectId },
        orderBy: { code: 'asc' },
        select: {
          id: true, code: true, name: true, phase: true, plannedStart: true, plannedFinish: true,
          actualStart: true, actualFinish: true, durationDays: true, progressPct: true,
          status: true, priority: true, isSummary: true, isMilestone: true, isCritical: true,
          totalFloat: true, wbsNodeId: true,
          responsible: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.taskDependency.findMany({ where: { successor: { projectId } } }),
      this.prisma.baseline.findFirst({
        where: { projectId, isActive: true },
        include: { tasks: true },
      }),
    ]);
    const baselineByTask = new Map(baseline?.tasks.map((b) => [b.taskId, b]) ?? []);
    return {
      project,
      tasks: tasks.map((t) => ({
        ...t,
        progressPct: dec(t.progressPct),
        baseline: baselineByTask.has(t.id)
          ? {
              plannedStart: baselineByTask.get(t.id)!.plannedStart,
              plannedFinish: baselineByTask.get(t.id)!.plannedFinish,
            }
          : null,
      })),
      dependencies: deps,
    };
  }

  // =========================================================================
  // Baselines
  // =========================================================================
  async saveBaseline(projectId: string, name: string) {
    const tasks = await this.prisma.task.findMany({ where: { projectId } });
    return this.prisma.$transaction(async (tx) => {
      await tx.baseline.updateMany({ where: { projectId }, data: { isActive: false } });
      return tx.baseline.create({
        data: {
          projectId,
          name,
          isActive: true,
          tasks: {
            create: tasks.map((t) => ({
              taskId: t.id,
              plannedStart: t.plannedStart,
              plannedFinish: t.plannedFinish,
              durationDays: t.durationDays,
              budget: t.budget,
            })),
          },
        },
        include: { _count: { select: { tasks: true } } },
      });
    });
  }

  listBaselines(projectId: string) {
    return this.prisma.baseline.findMany({
      where: { projectId },
      orderBy: { savedAt: 'desc' },
      include: { _count: { select: { tasks: true } } },
    });
  }

  async activateBaseline(id: string) {
    const baseline = await this.prisma.baseline.findUniqueOrThrow({ where: { id } });
    await this.prisma.$transaction([
      this.prisma.baseline.updateMany({ where: { projectId: baseline.projectId }, data: { isActive: false } }),
      this.prisma.baseline.update({ where: { id }, data: { isActive: true } }),
    ]);
    return { success: true };
  }

  // =========================================================================
  // Delay analysis — variance vs baseline
  // =========================================================================
  async delayAnalysis(projectId: string) {
    const baseline = await this.prisma.baseline.findFirst({
      where: { projectId, isActive: true },
      include: { tasks: true },
    });
    const tasks = await this.prisma.task.findMany({
      where: { projectId, isSummary: false },
      orderBy: { code: 'asc' },
      select: {
        id: true, code: true, name: true, status: true, plannedStart: true, plannedFinish: true,
        actualStart: true, actualFinish: true, progressPct: true, isCritical: true, totalFloat: true,
      },
    });
    const baseMap = new Map(baseline?.tasks.map((b) => [b.taskId, b]) ?? []);
    const today = new Date();

    const analysed = tasks.map((t) => {
      const base = baseMap.get(t.id);
      const baselineFinish = base?.plannedFinish ?? t.plannedFinish;
      let slippageDays = 0;
      if (t.actualFinish) {
        slippageDays = differenceInCalendarDays(t.actualFinish, baselineFinish);
      } else if (dec(t.progressPct) < 1 && baselineFinish < today) {
        slippageDays = differenceInCalendarDays(today, baselineFinish);
      }
      // expected progress by time elapsed
      const totalDur = Math.max(1, differenceInCalendarDays(t.plannedFinish, t.plannedStart));
      const elapsed = Math.min(totalDur, Math.max(0, differenceInCalendarDays(today, t.plannedStart)));
      const expectedProgress = elapsed / totalDur;
      const progressGap = round4(expectedProgress - dec(t.progressPct));
      return { ...t, progressPct: dec(t.progressPct), slippageDays, expectedProgress: round4(expectedProgress), progressGap };
    });

    const delayed = analysed
      .filter((t) => t.slippageDays > 0 || (t.progressGap > 0.1 && t.status !== 'COMPLETED'))
      .sort((a, b) => b.slippageDays - a.slippageDays || b.progressGap - a.progressGap);

    return {
      baselineName: baseline?.name ?? null,
      totalTasks: analysed.length,
      delayedCount: delayed.length,
      criticalDelayed: delayed.filter((t) => t.isCritical).length,
      worstSlippageDays: delayed[0]?.slippageDays ?? 0,
      delayedTasks: delayed,
    };
  }

  // =========================================================================
  // Resource allocation matrix + leveling histogram
  // =========================================================================
  async resourceMatrix(projectId: string, year: number) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: { projectId, year },
      include: { employee: { select: { id: true, firstName: true, lastName: true, position: true, department: true } } },
    });
    const byEmployee = new Map<string, any>();
    for (const a of allocations) {
      const key = a.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, { employee: a.employee, months: Array(12).fill(0) });
      }
      byEmployee.get(key).months[a.month - 1] = dec(a.utilizationPct);
    }
    const rows = [...byEmployee.values()];
    const headcount = Array(12)
      .fill(0)
      .map((_, m) => rows.filter((r) => r.months[m] > 0).length);
    return { year, rows, monthlyHeadcount: headcount };
  }

  async setAllocation(projectId: string, employeeId: string, year: number, month: number, utilizationPct: number) {
    if (utilizationPct <= 0) {
      await this.prisma.resourceAllocation.deleteMany({ where: { projectId, employeeId, year, month } });
      return { success: true };
    }
    return this.prisma.resourceAllocation.upsert({
      where: { projectId_employeeId_year_month: { projectId, employeeId, year, month } },
      create: { projectId, employeeId, year, month, utilizationPct, allocated: true },
      update: { utilizationPct, allocated: true },
    });
  }

  /** Daily assignment histogram for resource leveling review. */
  async resourceHistogram(projectId: string) {
    const assignments = await this.prisma.taskAssignment.findMany({
      where: { task: { projectId } },
      include: {
        task: { select: { plannedStart: true, plannedFinish: true, status: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const byEmployee = new Map<string, { employee: any; peak: number; overallocatedDays: number; days: Map<string, number> }>();
    for (const a of assignments) {
      if (a.task.status === 'COMPLETED' || a.task.status === 'CANCELLED') continue;
      const entry =
        byEmployee.get(a.employeeId) ??
        byEmployee
          .set(a.employeeId, { employee: a.employee, peak: 0, overallocatedDays: 0, days: new Map() })
          .get(a.employeeId)!;
      const start = a.task.plannedStart;
      const days = Math.max(1, differenceInCalendarDays(a.task.plannedFinish, start));
      for (let i = 0; i < days; i++) {
        const key = addDays(start, i).toISOString().slice(0, 10);
        entry.days.set(key, (entry.days.get(key) ?? 0) + dec(a.allocationPct));
      }
    }
    return [...byEmployee.values()].map((e) => {
      let peak = 0;
      let over = 0;
      for (const v of e.days.values()) {
        peak = Math.max(peak, v);
        if (v > 1) over++;
      }
      return { employee: e.employee, peakLoad: round4(peak), overallocatedDays: over };
    });
  }
}
