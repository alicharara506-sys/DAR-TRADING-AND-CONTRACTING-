import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, projectId?: string) {
    const equipment = await this.prisma.equipment.findMany({
      where: {
        companyId,
        ...(projectId && { assignments: { some: { projectId } } }),
      },
      include: {
        owner: { select: { id: true, name: true } },
        assignments: { include: { project: { select: { id: true, code: true, name: true } } } },
        maintenances: { where: { status: { in: ['SCHEDULED', 'OVERDUE'] } }, orderBy: { scheduledAt: 'asc' } },
        fuelLogs: { select: { cost: true, litres: true } },
      },
      orderBy: { code: 'asc' },
    });
    return equipment.map((e) => {
      const planned = e.assignments.reduce((s, a) => s + a.daysPlanned * dec(e.dailyRate), 0);
      const actual = e.assignments.reduce((s, a) => s + a.daysUsed * dec(e.dailyRate), 0);
      const fuelCost = e.fuelLogs.reduce((s, f) => s + dec(f.cost), 0);
      const { fuelLogs: _f, ...rest } = e;
      return {
        ...rest,
        plannedCost: round2(planned),
        actualCost: round2(actual + fuelCost),
        fuelCost: round2(fuelCost),
        utilization:
          e.assignments.reduce((s, a) => s + a.daysPlanned, 0) > 0
            ? Math.round(
                (e.assignments.reduce((s, a) => s + a.daysUsed, 0) /
                  e.assignments.reduce((s, a) => s + a.daysPlanned, 0)) * 1000,
              ) / 1000
            : 0,
      };
    });
  }

  create(companyId: string, dto: any) {
    return this.prisma.equipment.create({ data: { ...dto, companyId } });
  }
  update(id: string, dto: any) {
    return this.prisma.equipment.update({ where: { id }, data: dto });
  }
  async remove(id: string) {
    await this.prisma.equipment.update({ where: { id }, data: { status: 'DISPOSED' } });
    return { success: true };
  }

  assign(equipmentId: string, dto: any) {
    return this.prisma.equipmentAssignment.create({ data: { ...dto, equipmentId } });
  }
  updateAssignment(id: string, dto: any) {
    return this.prisma.equipmentAssignment.update({ where: { id }, data: dto });
  }

  // Maintenance
  listMaintenance(equipmentId?: string) {
    return this.prisma.maintenance.findMany({
      where: equipmentId ? { equipmentId } : {},
      include: { equipment: { select: { id: true, code: true, name: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }
  createMaintenance(dto: any) {
    return this.prisma.maintenance.create({ data: dto });
  }
  async completeMaintenance(id: string, dto: { cost?: number; performedBy?: string }) {
    const m = await this.prisma.maintenance.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), cost: dto.cost, performedBy: dto.performedBy },
    });
    // schedule next preventive occurrence
    if (m.type === 'PREVENTIVE' && m.intervalDays) {
      await this.prisma.maintenance.create({
        data: {
          equipmentId: m.equipmentId,
          type: 'PREVENTIVE',
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + m.intervalDays * 86_400_000),
          description: m.description,
          intervalDays: m.intervalDays,
        },
      });
    }
    return m;
  }

  // Fuel
  listFuelLogs(equipmentId: string) {
    return this.prisma.fuelLog.findMany({ where: { equipmentId }, orderBy: { date: 'desc' } });
  }
  createFuelLog(equipmentId: string, dto: any) {
    return this.prisma.fuelLog.create({ data: { ...dto, equipmentId } });
  }

  /** Flags overdue preventive maintenance. Called by cron + on demand. */
  async refreshOverdue() {
    const res = await this.prisma.maintenance.updateMany({
      where: { status: 'SCHEDULED', scheduledAt: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    return { flaggedOverdue: res.count };
  }
}
