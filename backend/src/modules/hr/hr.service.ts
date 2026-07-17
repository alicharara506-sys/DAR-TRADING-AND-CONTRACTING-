import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dec, round2 } from '../../common/utils/numbers';

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Employees ----
  listEmployees(companyId: string, filters: { department?: string; search?: string } = {}) {
    return this.prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        ...(filters.department && { department: filters.department }),
        ...(filters.search && {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { code: { contains: filters.search, mode: 'insensitive' } },
            { position: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        safetyTrainings: { orderBy: { completedAt: 'desc' }, take: 3 },
        _count: { select: { taskAssignments: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  createEmployee(companyId: string, dto: any) {
    return this.prisma.employee.create({ data: { ...dto, companyId } });
  }
  updateEmployee(id: string, dto: any) {
    return this.prisma.employee.update({ where: { id }, data: dto });
  }
  async removeEmployee(id: string) {
    await this.prisma.employee.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  // ---- Attendance ----
  listAttendance(filters: { projectId?: string; employeeId?: string; from?: Date; to?: Date }) {
    return this.prisma.attendance.findMany({
      where: {
        ...(filters.projectId && { projectId: filters.projectId }),
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        ...(filters.from || filters.to
          ? { date: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      include: { employee: { select: { id: true, code: true, firstName: true, lastName: true, trade: true } } },
      orderBy: { date: 'desc' },
      take: 500,
    });
  }

  markAttendance(dto: any) {
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date: dto.date } },
      create: dto,
      update: {
        status: dto.status,
        hoursWorked: dto.hoursWorked,
        otHours: dto.otHours,
        projectId: dto.projectId,
        note: dto.note,
      },
    });
  }

  async bulkAttendance(entries: any[]) {
    const results = [] as any[];
    for (const e of entries) results.push(await this.markAttendance(e));
    return { count: results.length };
  }

  // ---- Payroll ----
  listPayrollRuns(companyId: string) {
    return this.prisma.payrollRun.findMany({
      where: { companyId },
      include: {
        items: { include: { employee: { select: { code: true, firstName: true, lastName: true, position: true, department: true } } } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  /**
   * Generates a payroll run for a month from attendance records:
   * basic = dailyRate × working days; OT = otHours × otRate (workbook formula).
   */
  async generatePayroll(companyId: string, year: number, month: number) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    if (existing && existing.status !== 'DRAFT') {
      throw new BadRequestException(`Payroll ${year}-${month} already ${existing.status}`);
    }

    const employees = await this.prisma.employee.findMany({
      where: { companyId, isActive: true, isSubcontracted: false },
    });
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));
    const attendance = await this.prisma.attendance.findMany({
      where: { date: { gte: from, lte: to }, employee: { companyId } },
    });
    const byEmployee = new Map<string, { days: number; ot: number }>();
    for (const a of attendance) {
      const agg = byEmployee.get(a.employeeId) ?? { days: 0, ot: 0 };
      if (a.status === 'PRESENT') agg.days += 1;
      else if (a.status === 'HALF_DAY') agg.days += 0.5;
      agg.ot += dec(a.otHours);
      byEmployee.set(a.employeeId, agg);
    }

    return this.prisma.$transaction(async (tx) => {
      if (existing) await tx.payrollRun.delete({ where: { id: existing.id } });
      return tx.payrollRun.create({
        data: {
          companyId, year, month, status: 'DRAFT',
          items: {
            create: employees.map((e) => {
              const att = byEmployee.get(e.id) ?? { days: 0, ot: 0 };
              const basic = round2(att.days * dec(e.dailyRate));
              const ot = round2(att.ot * dec(e.otRate));
              return {
                employeeId: e.id,
                workingDays: Math.round(att.days),
                otHours: att.ot,
                basicPay: basic,
                otPay: ot,
                netPay: round2(basic + ot),
              };
            }),
          },
        },
        include: { items: { include: { employee: true } } },
      });
    });
  }

  async approvePayroll(id: string, userId: string, projectIdForCosting?: string) {
    const run = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId },
      include: { items: true },
    });
    // post to project cost ledger when a labour cost code exists
    if (projectIdForCosting) {
      const labourCode = await this.prisma.costCode.findFirst({
        where: { projectId: projectIdForCosting, category: 'LABOUR' },
      });
      if (labourCode) {
        const total = run.items.reduce((s, i) => s + dec(i.netPay), 0);
        await this.prisma.costEntry.create({
          data: {
            projectId: projectIdForCosting,
            costCodeId: labourCode.id,
            date: new Date(run.year, run.month - 1, 28),
            description: `Payroll ${run.year}-${String(run.month).padStart(2, '0')}`,
            amount: round2(total),
            reference: `PAYROLL-${run.year}-${run.month}`,
            source: 'PAYROLL',
          },
        });
      }
    }
    return run;
  }

  // ---- Safety training ----
  listTrainings(employeeId?: string) {
    return this.prisma.safetyTrainingRecord.findMany({
      where: employeeId ? { employeeId } : {},
      include: { employee: { select: { code: true, firstName: true, lastName: true } } },
      orderBy: { completedAt: 'desc' },
    });
  }
  createTraining(dto: any) {
    return this.prisma.safetyTrainingRecord.create({ data: dto });
  }

  /** HR dashboard aggregate. */
  async hrSummary(companyId: string) {
    const [employees, expiring] = await Promise.all([
      this.prisma.employee.findMany({ where: { companyId, isActive: true } }),
      this.prisma.safetyTrainingRecord.findMany({
        where: {
          employee: { companyId },
          expiresAt: { lte: new Date(Date.now() + 30 * 86_400_000), gte: new Date() },
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const byDept: Record<string, number> = {};
    for (const e of employees) byDept[e.department] = (byDept[e.department] ?? 0) + 1;
    const monthlyPayrollEstimate = employees.reduce((s, e) => s + dec(e.dailyRate) * 26, 0);
    return {
      headcount: employees.length,
      byDepartment: byDept,
      monthlyPayrollEstimate: round2(monthlyPayrollEstimate),
      expiringTrainings: expiring,
    };
  }
}
